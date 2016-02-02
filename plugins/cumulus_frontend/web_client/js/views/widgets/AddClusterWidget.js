minerva.views.AddClusterWidget = minerva.View.extend({
    events: {
        'click .m-cluster-launch-button': function(e) {
            girder.restRequest({
                path: '/clusters',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(this.params())
            }).done(_.bind(function (resp) {
                girder.restRequest({
                    path: '/clusters/' + resp._id + '/launch',
                    type: 'PUT'
                }).done(_.bind(function (resp) {
                    this.parentView.collection.fetch();

                    // Hide modal (@todo better way to do this)
                    $('.modal-footer a[data-dismiss="modal"]').click();
                }, this));
            }, this));
        }
    },

    initialize: function(settings) {
        this.el = settings;
        this.parentView = settings.parentView;
        this.profileId = settings.profileId;

        return this;
    },

    render: function () {
        this.$el.html(girder.templates.addClusterWidget()).girderModal(this);

        return this;
    },

    params: function () {
        // Defaults
        var params = {
            type: 'ansible',
            template: {
                playbook: 'default'
            },
            profile: this.profileId
        };

        // Deep copy
        $.extend(true, params, {
            name: this.$('#m-cluster-name').val(),
            template: {
                aws_keyname: this.$('#m-cluster-aws-keyname').val(),
                instance_type: this.$('#m-cluster-instance-type').val(),
                instance_count: this.$('#m-cluster-instance-count').val()
            }
        });

        return params;
    }
});
