minerva.views.MapPanel = minerva.views.Panel.extend({

    events: {
        'click .m-save-current-baselayer': function () {
            this.session.metadata().map.center = this.map.center();
            this.session.metadata().map.zoom = this.map.zoom();
            this.session.saveSession();
        }
    },

    changeLayerOpacity: function (dataset) {
        // TODO ideally move opacity from the Dataset to the Layer.
        var layerRepr = this.datasetLayerReprs[dataset.get('_id')];
        layerRepr.setOpacity(dataset.get('opacity'));
    },

    changeLayerZIndex: function (dataset) {
        var baseMapZIndex = 1;
        if (dataset.get('order')) {
            this.datasetLayerReprs[dataset.id][dataset.get('order')]();
        }
        // TODO: HACK MoveToBottom method will set the layer's index to 0 and put it under the base map.
        // Calling moveUp(1) to place it on top of base map
        if (dataset.get('order') === 'moveToBottom') {
            this.datasetLayerReprs[dataset.id].moveUp(baseMapZIndex);
        }
        this.map.draw();
    },

    // MapContainer Interface >>
    deleteGeoJsLayer: function (geoJsLayer) {
        this.map.deleteLayer(geoJsLayer);
    },

    createGeoJsLayer: function (geoJsLayerType) {
        return this.map.createLayer(geoJsLayerType);
    },

    getMapView: function () {
        return this;
    },
    // << MapContainer Interface

    /**
     * TODO REDO
     * Add the passed in dataset to the current map as a rendered layer.
     *
     * @param {Object} DatasetModel or descendent.
     */
    addDataset: function (dataset) {
        var datasetId = dataset.get('_id');
        if (!_.contains(this.datasetLayerReprs, datasetId)) {
            // For now, get the layerType directly from the dataset,
            // but we should really allow the user to specify the desired
            // layerType.
            var layerType = dataset.getGeoRenderType();
            var registry = minerva.adapters.MapAdapterRegistry;
            registry.once('m:map_adapter_layerCreated', function (layerRepr) {
                this.datasetLayerReprs[datasetId] = layerRepr;
                this.map.draw();
            }, this).once('m:map_adapter_error', function (dataset, layerType) {
                dataset.set('geoError', true);
            }, this).once('m:map_adapter_layerError', function (layerRepr) {
                if (layerRepr) {
                    layerRepr.deleteLayer(this);
                    dataset.set('geoError', true);
                }
            }, this).createLayer(this, dataset, layerType);
        }
    },

    /** */
    removeDataset: function (dataset) {
        var datasetId = dataset.get('_id');
        var layerRepr = this.datasetLayerReprs[datasetId];
        if (layerRepr) {
            layerRepr.deleteLayer(this);
            this.map.draw();
        }
        delete this.datasetLayerReprs[datasetId];
    },



    initialize: function (settings) {
        this.session = settings.session.model;
        this.listenTo(this.session, 'm:mapUpdated', function () {
            // TODO for now only dealing with center
            if (this.map) {
                // TODO could better separate geojs needs from session storage
                this.map.center(this.session.metadata().map.center);
            }
        });
        this.datasetLayerReprs = {};
        this.legendWidget = {};

        this.collection = settings.session.datasetsCollection;
        this.listenTo(this.collection, 'change:displayed', function (dataset) {
            // There is a slight danger of a user trying to add a dataset
            // to a session while the map is not yet created.  If the map isn't
            // created, we don't need to add/remove the datasets here because
            // they will be taken care of in the renderMap initialization block.
            if (this.mapCreated) {
                if (dataset.get('displayed')) {
                    this.addDataset(dataset);
                } else {
                    this.removeDataset(dataset);
                }
            }
        }, this);

        this.listenTo(this.collection, 'change:opacity', function (dataset) {
            if (this.mapCreated) {
                this.changeLayerOpacity(dataset);
            }
        }, this);

        this.listenTo(this.collection, 'change:order', function (dataset) {
            if (this.mapCreated) {
                this.changeLayerZIndex(dataset);
            }
        }, this);

        minerva.views.Panel.prototype.initialize.apply(this);
    },

    renderMap: function () {
        if (!this.map) {
            var mapSettings = this.session.metadata().map;
            this.map = geo.map({
                node: '.m-map-panel-map',
                center: mapSettings.center,
                zoom: mapSettings.zoom,
                interactor: geo.mapInteractor({
                    map: this.map,
                    click: {
                        enabled: true,
                        cancelOnMove: true
                    }
                })
            });
            this.map.createLayer(mapSettings.basemap,
                                 _.has(mapSettings, 'basemap_args')
                                 ? mapSettings.basemap_args : {});
            this.uiLayer = this.map.createLayer('ui');
            this.mapCreated = true;
            _.each(this.collection.models, function (dataset) {
                if (dataset.get('displayed')) {
                    this.addDataset(dataset);
                }
            }, this);
        }
        this.map.draw();
    },

    render: function () {
        this.$el.html(minerva.templates.mapPanel({}));
        this.renderMap();
        var tooltipProperties = {
            placement: 'left',
            delay: 400,
            container: this.$el,
            trigger: 'hover'
        };
        this.$('.m-save-current-baselayer').tooltip(tooltipProperties);
        return this;
    }
});
