/**
 * This widget displays options for rendering choropleth layers
 */
minerva.views.ChoroplethRenderWidget = minerva.View.extend({
    initialize: function (settings) {
        this.dataset = settings.dataset;
    },

    events: {
        'submit #m-choropleth-render-form': function (e) {
            e.preventDefault();
            this.$('.g-validation-failed-message').text('');

            var minervaMetadata = this.dataset.getMinervaMetadata();
            minervaMetadata.colorByValue = $('#m-choropleth-value-source option:selected').text();
            minervaMetadata.colorScheme = $('#m-choropleth-color-config > button.active').attr('data-color-name');
            this.dataset.saveMinervaMetadata(minervaMetadata);
            this.$el.modal('hide');
        }
    },

    render: function () {
        var minervaMetadata = this.dataset.getMinervaMetadata();
        var scheme = minervaMetadata.colorScheme || 'YlOrRd';
        var modal = this.$el.html(minerva.templates.choroplethRenderWidget({
            values: minervaMetadata.values,
            colors: colorbrewer
        })).girderModal(this);

        var buttons = this.$('#m-choropleth-color-config > .btn');
        this.$('button[data-color-name="' + scheme + '"]').addClass('active');

        buttons.click(function () {
            var $this = $(this);
            buttons.removeClass('active');
            $this.addClass('active');
        });
        modal.trigger($.Event('reader.girder.modal', {relatedTarget: modal}));
    },

    setCurrentDataset: function (dataset) {
        this.dataset = dataset;
        this.render();
    }
});
