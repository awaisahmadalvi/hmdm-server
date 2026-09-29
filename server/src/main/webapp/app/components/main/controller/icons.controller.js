// Localization completed
angular.module('headwind-kiosk')
    .controller('IconsTabController', function ($scope, $rootScope, $timeout, $state, $modal, alertService, confirmModal,
                                                 iconService, fileService, $window, localization) {
        $scope.search = {};
        $scope.loading = false;

        $scope.paging = {
            currentPage: 1,
            pageSize: 48
        };

        $scope.$watch('paging.currentPage', function () {
            $window.scrollTo(0, 0);
        });

        // Icon objects (iconService.getAllIcons) only carry id/name/fileId/
        // fileName - no ready-to-use image URL. fileService.getAllFiles
        // (the same call the add/edit dialog already makes for its file
        // picker) returns each file's real, server-computed .url, so it's
        // reused here too, cross-referenced by fileId, to render gallery
        // thumbnails without inventing a new backend endpoint.
        var fileUrlById = {};

        $scope.iconThumbUrl = function (icon) {
            return icon && icon.fileId ? fileUrlById[icon.fileId] : null;
        };

        $scope.init = function () {
            $rootScope.settingsTabActive = true;
            $rootScope.pluginsTabActive = false;
            $scope.paging.currentPage = 1;
            $scope.search();
        };

        $scope.search = function () {
            $scope.loading = true;
            iconService.getAllIcons({value: $scope.search.searchValue},
                function (response) {
                    $scope.loading = false;
                    $scope.icons = response.data;
                    $scope.paging.currentPage = 1;
                });

            fileService.getAllFiles({}, function (response) {
                if (response.status === 'OK') {
                    fileUrlById = {};
                    response.data.forEach(function (file) {
                        fileUrlById[file.id] = file.url;
                    });
                }
            });
        };

        $scope.clearSearch = function () {
            $scope.search.searchValue = '';
            $scope.search();
        };

        // Live search: debounce while typing, reusing the exact same
        // search() Enter already triggers - not a separate search path.
        // (Previously this fired on every keystroke with no debounce at
        // all via ng-change="search()" on the input.)
        var searchDebounceTimer = null;
        $scope.$watch('search.searchValue', function (newVal, oldVal) {
            if (newVal === oldVal) {
                return;
            }
            if (searchDebounceTimer) {
                $timeout.cancel(searchDebounceTimer);
            }
            searchDebounceTimer = $timeout(function () {
                $scope.search();
            }, 400);
        });

        $scope.iconsToast = null;

        var showIconsToast = function (type, message) {
            $scope.iconsToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.iconsToast && $scope.iconsToast.message === message) {
                    $scope.iconsToast = null;
                }
            }, 3000);
        };

        $scope.editIcon = function (icon) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/addIcon.html',
                controller: 'IconModalController',
                size: 'lg',
                resolve: {
                    icon: function () {
                        return icon;
                    }
                }
            });

            modalInstance.result.then(function (result) {
                $scope.search();
                if (result) {
                    showIconsToast('success', localization.localize('success.icon.saved'));
                }
            });
        };

        $scope.removeIcon = function (icon) {
            let localizedText = localization.localize('question.delete.icon').replace('${iconName}', icon.name) +
                ' ' + localization.localize('question.delete.user.warning');
            confirmModal.getUserConfirmation(localizedText, function () {
                iconService.removeIcon({id: icon.id}, function (response) {
                    if (response.status === 'OK') {
                        $scope.search();
                    } else {
                        showIconsToast('error', localization.localizeServerResponse(response));
                    }
                }, function () {
                    showIconsToast('error', localization.localize('error.request.failure'));
                });
            });
        };

        $scope.init();
    })
    .controller('IconModalController', function ($scope, $modalInstance, $modal, iconService, fileService, icon, localization) {
        $scope.icon = {};
        for (var prop in icon) {
            if (icon.hasOwnProperty(prop)) {
                $scope.icon[prop] = icon[prop];
            }
        }

        $scope.files = [];
        fileService.getAllFiles({},
            function (response) {
                if (response.status === 'OK') {
                    // Exclude non-image files
                    response.data = response.data.filter(f => f.filePath != null &&
                        (f.filePath.endsWith(".jpg") || f.filePath.endsWith(".png") || f.filePath.endsWith(".jpeg")));

                    response.data.forEach(function (file) {
                        file.name = file.description ? file.description :
                            file.external ? file.url : file.filePath;
                        if (file.external) {
                            file.externalUrl = file.url;
                        }
                        if (file.id === $scope.icon.fileId) {
                            $scope.file = file;
                        }
                    });
                    $scope.files = response.data;
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            });

        $scope.selectFile = function (file) {
            $scope.file = file;
        };

        // Opens the same shared "add/edit file" dialog the Default Design
        // page's background-image upload uses, so a brand new image can be
        // uploaded without leaving this dialog. Its result already carries
        // both .id and .url (see FilesResource#createFileInternal), so the
        // new file can be selected immediately and shows up in the picker.
        $scope.uploadNewFile = function () {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/file.html',
                controller: 'FileModalController',
                resolve: {
                    file: function () {
                        return null;
                    }
                }
            });

            modalInstance.result.then(function (data) {
                if (data) {
                    data.name = data.description ? data.description : (data.external ? data.url : data.filePath);
                    $scope.files.unshift(data);
                    $scope.file = data;
                }
            });
        };

        $scope.previewIconSizeClass = function (size) {
            return 'icon-preview-' + size;
        };

        $scope.savingIcon = false;

        $scope.save = function () {
            $scope.successMessage = '';
            $scope.errorMessage = '';

            $scope.icon.fileId = $scope.file ? $scope.file.id : undefined;
            if (!$scope.icon.name) {
                $scope.errorMessage = localization.localize('error.icon.empty.name');
            } else if (!$scope.icon.fileId) {
                $scope.errorMessage = localization.localize('error.icon.empty.file');
            } else {
                var request = {};
                for (var prop in $scope.icon) {
                    if ($scope.icon.hasOwnProperty(prop)) {
                        request[prop] = $scope.icon[prop];
                    }
                }

                $scope.savingIcon = true;
                iconService.createIcon(request, function (response) {
                    $scope.savingIcon = false;
                    if (response.status === 'OK') {
                        $modalInstance.close(true);
                    } else {
                        $scope.errorMessage = localization.localize('error.duplicate.icon.name');
                    }
                }, function () {
                    $scope.savingIcon = false;
                    $scope.errorMessage = localization.localize('error.request.failure');
                });
            }
        };

        $scope.cancel = function () {
            $modalInstance.dismiss();
        }
    });
