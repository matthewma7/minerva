/**
 * This widget is used to navigate the data hierarchy of folders and items.
 * With only readonly data. 
 */
minerva.views.ReadOnlyHierarchyWidget = girder.views.HierarchyWidget.extend({


    initialize: function () {


        girder.views.HierarchyWidget.prototype.initialize.apply(this, arguments);
        // wrap itemListView render with a trigger so we know whe it is done
        // we'll hoook into this later to check if we need to do any selecting
        // based on previous dataset state (see DatasetHierarchyWidget.js)

               
        //
    },

    _initFolderViewSubwidgets: function () {
        
        this.itemListView = new minerva.views.ItemListWidget({
            folderId: this.parentModel.get('_id'),
            checkboxes: this._checkboxes,
            parentView: this
            //selected: cid
        });
        
        this.itemListView.on('g:itemClicked', this._onItemClick, this)
            .off('g:checkboxesChanged')
            .on('g:checkboxesChanged', this.updateChecked, this)
            .off('g:changed').on('g:changed', function () {
                this.itemCount = this.itemListView.collection.length;
                this._childCountCheck();
            }, this);

    },

    
    
    _fetchToRoot: function (folder) {
        var parentId = folder.get('parentId');
        var parentType = folder.get('parentCollection');
        var parent = new girder.models[girder.getModelClassByName(parentType)]();
        
        parent.set({
            _id: parentId
        }).on('g:fetched', function () {
            this.breadcrumbs.push(parent);

            if (parentType === 'folder' && parent.get('name') !== folder.get('minerva').bucket) {
                this._fetchToRoot(parent);
            } else {
                this.breadcrumbs.reverse();
                this.render();
            }
        }, this).fetch();
    },

        
    render: function () {
        this.folderCount = null;
        this.itemCount = null;

        this.$el.html(minerva.templates.readOnlyHierarchyWidget({
            type: this.parentModel.resourceName,
            model: this.parentModel,
            // force 'level'  to be READ
            level: girder.AccessType.READ,
            AccessType: girder.AccessType,
            showActions: this._showActions,
            checkboxes: this._checkboxes
        }));

        if (this.$('.g-folder-actions-menu>li>a').length === 0) {
            // Disable the actions button if actions list is empty
            this.$('.g-folder-actions-button').attr('disabled', 'disabled');
        }

        this.breadcrumbView.setElement(this.$('.g-hierarchy-breadcrumb-bar>ol')).render();
    //    this.checkedMenuWidget.dropdownToggle = this.$('.g-checked-actions-button');
    //    this.checkedMenuWidget.setElement(this.$('.g-checked-actions-menu')).render();
        this.folderListView.setElement(this.$('.g-folder-list-container')).render();

        if (this.parentModel.resourceName === 'folder' && this._showItems) {

            var itemId = this.parentView.folder.get('minerva').selectedItems[0] || false;            
            this.itemListView.selected = itemId;
            
            this.itemListView.setElement(this.$('.g-item-list-container')).render();
        }

        this.$('.g-folder-info-button,.g-folder-access-button,.g-select-all,' +
            '.g-upload-here-button,.g-checked-actions-button').tooltip({
                container: this.$el,
                animation: false,
                delay: {
                    show: 100
                }
            });
        this.$('.g-folder-actions-button,.g-hierarchy-level-up').tooltip({
            container: this.$el,
            placement: 'left',
            animation: false,
            delay: {
                show: 100
            }
        });

        return this;
    },

    /**
     * When any of the checkboxes is changed, this will be called to update
     * the checked menu state.
     */
    updateChecked: function () {
        var folders = this.folderListView.checked,
            items = [];

        var minFolderLevel = girder.AccessType.ADMIN;
        _.every(folders, function (cid) {
            var folder = this.folderListView.collection.get(cid);
            minFolderLevel = Math.min(minFolderLevel, folder.getAccessLevel());
            return minFolderLevel > girder.AccessType.READ; // acts as 'break'
        }, this);

        var minItemLevel = girder.AccessType.ADMIN;
        if (this.itemListView) {
            items = this.itemListView.checked;
            if (items.length) {
                minItemLevel = Math.min(minItemLevel, this.parentModel.getAccessLevel());
            }
        }

        // switch to use-selected button instead of item action dropdown
        if (folders.length + items.length) {
            this.parentView.$('.m-use-selected-button').removeClass('disabled');

            // DEMO - only allow one item to be selected for the demo
            this.parentView.$('.g-list-checkbox:not(:checked)').attr('disabled', true);
        } else {
            this.parentView.$('.m-use-selected-button').addClass('disabled', 'disabled');

            // DEMO - on uncheck allow any other checkbox to be checked
            this.parentView.$('.g-list-checkbox:not(:checked)').removeAttr('disabled');
        }

    },

    getCheckedResources: function (){
        return this._getCheckedResourceParam(true);
    }

    
});
