minerva.adapters = minerva.adapters || {};

(function () {
    function MapAdapterRegistry() {
        this.registry = {};
        this.register = function (layerType, mapLayerDefinition) {
            this.registry[layerType] = mapLayerDefinition;
        };
        this.createLayer = function (mapContainer, dataset, layerType) {
            if (layerType === null || !_.has(this.registry, layerType)) {
                console.error('This dataset cannot be adapted to a map layer of type [' + layerType + '].');
                this.trigger('m:map_adapter_error', dataset, layerType);
                return;
            } else {
                var adapter = this.registry[layerType];
                var layerRepr = _.extend(new adapter(), Backbone.Events);
                var visProperties = layerRepr.collectUserInput(dataset);
                dataset.once('m:dataset_geo_dataLoaded', function () {
                    layerRepr.once('m:map_layer_renderable', function (layer) {
                        this.trigger('m:map_adapter_layerCreated', layer);
                    }, this).once('m:map_layer_error', function (layer) {
                        this.trigger('m:map_adapter_layerError', layer);
                    }, this).initLayer(mapContainer, dataset, dataset.get('geoData'), visProperties);
                }, this).loadGeoData();
                //
                // Instead of dataset.loadGeoData, ideally something like
                // girder.RestRequest({
                //     type: "POST"
                //     url: "adapter/" + dataset._id + "/" + layerType.toString()(),
                //     params: userInput,
                // }).success(function (data){
                //     createLayer
                // });
            }
        };
    }
    minerva.adapters.MapAdapterRegistry = _.extend(new MapAdapterRegistry(), Backbone.Events);
})();

minerva.representations = minerva.representations || {};
minerva.representations.defineMapLayer = function (layerType, layerDefinition, parentDefinition) {
    if (parentDefinition) {
        layerDefinition.prototype = new parentDefinition();
    }
    minerva.adapters.MapAdapterRegistry.register(layerType, layerDefinition);
    return layerDefinition;
}

minerva.representations.MapLayer = minerva.representations.defineMapLayer('map', function () {
    this.deleteLayer = function (mapContainer) {
        mapContainer.deleteGeoJsLayer(this.geoJsLayer);
    },

    this.setOpacity = function (opacity) {
        this.geoJsLayer.opacity(opacity);
    },

    this.collectUserInput = function (dataset) {
        return {};
    }
});

minerva.representations.JsonReaderMapLayer = minerva.representations.defineMapLayer('geojson', function () {
    this.readerType = 'jsonReader',

    this.initLayer = function (mapContainer, dataset, data, visProperties) {
        this.geoJsLayer = mapContainer.createGeoJsLayer('feature');
        try {
            var reader = geo.createFileReader(this.readerType, {layer: this.geoJsLayer});
            reader.read(data, _.bind(function () {
                this.trigger('m:map_layer_renderable', this);
            }, this));
        } catch (err) {
            console.error('This layer cannot be rendered to the map');
            console.error(err);
            this.trigger('m:map_layer_error', this);
        }
    }
}, minerva.representations.MapLayer);

minerva.representations.ContourJsonReaderMapLayer = minerva.representations.defineMapLayer('contour', function () {
    this.readerType = 'contourJsonReader'
}, minerva.representations.JsonReaderMapLayer);

minerva.representations.ChoroplethMapLayer = minerva.representations.defineMapLayer('choropleth', function () {
    this.collectUserInput = function (dataset) {
        return {
            colorByValue: dataset.getMinervaMetadata().colorByValue,
            colorScheme: dataset.getMinervaMetadata().colorScheme
        };
    },

    this.initLayer = function (mapContainer, dataset, jsonData, visProperties) {
        this.geoJsLayer = mapContainer.createGeoJsLayer('feature');
        var data = [];
        var colorByValue = visProperties.colorByValue;
        var colorScheme = visProperties.colorScheme;

        var polygon = this.geoJsLayer.createFeature('polygon', {selectionAPI: true});
        // Loop through the data and transform multipolygons into
        // arrays of polygons.  Note: it would also be possible
        // to generate a polygon feature for each polygon/multipolygon
        // geometry in the geojson, but this would (1) inefficient, and
        // (2) make handling mouse events much more difficult.
        JSON.parse(jsonData).features.forEach(function (f) {
            if (f.geometry.type === 'Polygon') {
                data.push({
                    outer: f.geometry.coordinates[0],
                    inner: f.geometry.coordinates.slice(1),
                    properties: f.properties
                });
            } else if (f.geometry.type === 'MultiPolygon') {
                f.geometry.coordinates.forEach(function (p) {
                    // all of the split polygons share the same property object
                    data.push({
                        outer: p[0],
                        inner: p.slice(1),
                        properties: f.properties
                    });
                });
            }
        });

        var value = function (_a, _b, d) {
            return (d || {}).properties[visProperties.colorByValue] || 0;
        };

        // the data extent
        var extent = d3.extent(data, function (d) {
            return d.properties[visProperties.colorByValue];
        });

        // generate the color scale
        var domain = [extent[0], 0.5 * (extent[0] + extent[1]), extent[1]];
        var scale = d3.scale.linear()
            .domain(domain)
            .range(colorbrewer[visProperties.colorScheme][3]);

        polygon.position(function (d) {
            return {
                x: d[0],
                y: d[1],
                z: d[2] || 0
            };
        }).style({
            fillColor: function () {
                var v = value.apply(value, arguments);
                var c = scale(v);
                c = geo.util.convertColor(c);
                return c;
            },
        }).data(data);

        var clickInfo = new minerva.models.ClickInfoModel();

        polygon.geoOn(geo.event.feature.mouseclick, _.bind(function (d) {
            clickInfo.set({
                layer: this.geoJsLayer,
                dataset: dataset,
                mouse: d.mouse,
                datum: d.data.properties
            });

            if (!this.clickInfoWidget) {
                this.clickInfoWidget = new minerva.views.ClickInfoWidget({
                    model: clickInfo,
                    parentView: mapContainer.getMapView()
                });
            }
        }, this));
        this.trigger('m:map_layer_renderable', this);
    }
}, minerva.representations.MapLayer);
