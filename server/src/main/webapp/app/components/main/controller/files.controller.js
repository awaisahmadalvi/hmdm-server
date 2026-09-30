// Localization completed
angular.module('headwind-kiosk')
    .controller('FilesTabController', function ($scope, $rootScope, $state, $modal, $timeout, alertService, confirmModal, fileService,
                                                authService, $window, localization, storageService) {
        $scope.search = {};

        $scope.paging = {
            currentPage: 1,
            pageSize: 50
        };

        $scope.$watch('paging.currentPage', function () {
            $window.scrollTo(0, 0);
        });

        $scope.hasPermission = authService.hasPermission;

        $scope.url = document.URL.replace("/#/login", "").replace("/#/", "");

        $scope.readableSizeMb = function(size) {
            if (size != -1) {
                return storageService.readableSize(size) + " Mb";
            } else {
                // -1 means the file doesn't exist
                return localization.localize('form.file.deleted')
            }
        };

        // Proper KB/MB/GB human-readable size with consistent casing and
        // better precision than readableSizeMb (kept above, unused by the
        // new template but left in place since storageService.readableSize
        // is shared with the Applications page and isn't touched here).
        var humanSize = function (bytes) {
            if (bytes < 1024) {
                return bytes + ' B';
            } else if (bytes < 1048576) {
                return (bytes / 1024).toFixed(bytes < 102400 ? 1 : 0) + ' KB';
            } else if (bytes < 1073741824) {
                return (bytes / 1048576).toFixed(bytes < 104857600 ? 1 : 0) + ' MB';
            } else {
                return (bytes / 1073741824).toFixed(1) + ' GB';
            }
        };

        $scope.humanFileSize = function (file) {
            if (file.external) {
                return '';
            }
            if (file.size === -1) {
                return localization.localize('form.file.deleted');
            }
            return humanSize(file.size);
        };

        $scope.totalSize = function () {
            if (!$scope.files || $scope.files.length === 0) {
                return '';
            }
            var total = 0;
            var any = false;
            $scope.files.forEach(function (file) {
                if (!file.external && file.size > 0) {
                    total += file.size;
                    any = true;
                }
            });
            return any ? (localization.localize('form.files.total.size.prefix') + ' ' + humanSize(total)) : '';
        };

        $scope.relativeTime = function (timestamp) {
            if (!timestamp) {
                return '';
            }
            var diff = Date.now() - timestamp;
            var minute = 60000, hour = 3600000, day = 86400000;
            if (diff < minute) {
                return localization.localize('form.files.time.justnow');
            } else if (diff < hour) {
                return Math.floor(diff / minute) + ' ' + localization.localize('form.files.time.minutesago');
            } else if (diff < day) {
                return Math.floor(diff / hour) + ' ' + localization.localize('form.files.time.hoursago');
            } else {
                return Math.floor(diff / day) + ' ' + localization.localize('form.files.time.daysago');
            }
        };

        var FILE_TYPE_MAP = [
            { exts: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'], icon: 'glyphicon-picture', cls: 'file-type-icon-image', isImage: true },
            { exts: ['pdf'], icon: 'glyphicon-file', cls: 'file-type-icon-pdf', isImage: false },
            { exts: ['apk'], icon: 'glyphicon-cog', cls: 'file-type-icon-apk', isImage: false },
            { exts: ['zip', 'rar', '7z', 'tar', 'gz'], icon: 'glyphicon-compressed', cls: 'file-type-icon-archive', isImage: false },
            { exts: ['txt', 'csv', 'json', 'xml', 'log', 'md', 'yml', 'yaml'], icon: 'glyphicon-align-left', cls: 'file-type-icon-text', isImage: false }
        ];
        var DEFAULT_FILE_TYPE = { icon: 'glyphicon-file', cls: 'file-type-icon-generic', isImage: false };

        $scope.fileTypeInfo = function (file) {
            var name = file.external ? (file.externalUrl || file.url || '') : (file.filePath || '');
            var dotIdx = name.lastIndexOf('.');
            var ext = dotIdx > -1 ? name.substring(dotIdx + 1).toLowerCase() : '';
            for (var i = 0; i < FILE_TYPE_MAP.length; i++) {
                if (FILE_TYPE_MAP[i].exts.indexOf(ext) !== -1) {
                    return FILE_TYPE_MAP[i];
                }
            }
            return DEFAULT_FILE_TYPE;
        };

        $scope.filesToast = null;
        var showFilesToast = function (type, message) {
            $scope.filesToast = { type: type, message: message };
            $timeout(function () {
                if ($scope.filesToast && $scope.filesToast.message === message) {
                    $scope.filesToast = null;
                }
            }, 3000);
        };

        $scope.availableSpace = null;
        var updateLimit = function() {
            fileService.getLimit(function(response) {
                if (response.status === 'OK' &&
                    response.data.sizeLimit > 0) {
                    var availableSpace = response.data.sizeLimit - response.data.sizeUsed;
                    if (availableSpace < 0) {
                        availableSpace = 0;
                    }
                    if (availableSpace < 20) {
                        $scope.availableSpace = localization.localize('form.file.available')
                            .replaceAll('${space}', availableSpace);
                    }
                }
            });
        };

        $scope.init = function () {
            updateLimit();
            $rootScope.settingsTabActive = false;
            $rootScope.pluginsTabActive = false;
            $scope.paging.currentPage = 1;
            $scope.search();
        };

        $scope.updateTimeFormat = localization.localize('format.files.date.update');
        $scope.loading = true;
        $scope.search = function () {
            $scope.loading = true;
            fileService.getAllFiles({value: $scope.search.searchValue},
                function (response) {
                    $scope.loading = false;
                    response.data.forEach(function (file) {
                        file.removeButtonTooltip = '';
                        if (file.usedByConfigurations && file.usedByConfigurations.length > 0) {
                            file.removalDisabled = true;
                            var s = localization.localize("tooltip.usage.byconfigurations");
                            file.usedByConfigurations.forEach(function (item) {
                                s += "\n";
                                s += item;
                            });
                            file.removeButtonTooltip += s;
                        }
                        if (file.usedByIcons && file.usedByIcons.length > 0) {
                            file.removalDisabled = true;
                            var s = localization.localize("tooltip.usage.byicons");
                            file.usedByIcons.forEach(function (item) {
                                s += "\n";
                                s += item;
                            });
                            file.removeButtonTooltip += s;
                        }
                        file.copyLinkTooltip = localization.localize("form.file.copy.link")
                            .replaceAll('${link}', file.url);
                    });

                    $scope.files = response.data;
                }, function () {
                    $scope.loading = false;
                });
        };

        $scope.clearSearch = function () {
            $scope.search.searchValue = '';
            $scope.search();
        };

        // Live search: debounce while typing, same search() Enter already
        // triggers - not a separate search path (established pattern, see
        // Groups/Icons/Users pages).
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

        $scope.copyLink = function(file) {
            navigator.clipboard.writeText(file.url);
            showFilesToast('success', localization.localize('form.files.toast.link.copied'));
        };

        $scope.copiedPathId = null;
        $scope.copyPath = function (file) {
            if (!file.devicePath || !navigator.clipboard) {
                return;
            }
            // navigator.clipboard.writeText() is a native Promise, not $q -
            // its .then() runs outside Angular's digest, so scope changes
            // made directly inside it never render. $timeout() (even with
            // no delay) is the safe way to hop back into a digest.
            navigator.clipboard.writeText(file.devicePath).then(function () {
                $timeout(function () {
                    $scope.copiedPathId = file.id;
                });
                $timeout(function () {
                    if ($scope.copiedPathId === file.id) {
                        $scope.copiedPathId = null;
                    }
                }, 2000);
            });
        };

        $scope.editFile = function(file) {
            if (file && file.external) {
                file.externalUrl = file.url;
            }
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/file.html',
                controller: 'FileModalController',
                resolve: {
                    file: function () {
                        return file;
                    }
                }
            });

            modalInstance.result.then(function (response) {
                updateLimit();
                if (angular.equals(file, {})) {
                    $scope.editConfiguration(response);
                } else {
                    $scope.search();
                    showFilesToast('success', localization.localize('success.file.saved'));
                }
            });

        };

        $scope.removeFile = function (file) {
            var fileName = file.description ? file.description :
                (file.external ? file.url : file.filePath);
            confirmModal.getUserConfirmation(localization.localize('question.delete.file').replace('${fileName}', fileName), function () {
                fileService.removeFile(file, function (response) {
                    if (response.status === 'OK') {
                        updateLimit();
                        $scope.search();
                        showFilesToast('success', localization.localize('success.file.deleted'));
                    } else {
                        alertService.showAlertMessage(localization.localize(response.message));
                        showFilesToast('error', localization.localize(response.message));
                    }
                });
            });
        };

        $scope.editConfiguration = function(file) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/fileConfigurations.html',
                controller: 'FileConfigurationsModalController',
                resolve: {
                    file: function () {
                        return file;
                    }
                }
            });

            modalInstance.result.then(function () {
                $scope.search();
                showFilesToast('success', localization.localize('success.file.configurations.saved'));
            });
        };

        $scope.showApps = function (file) {
            fileService.getApps({value: encodeURIComponent(file.url)}, function (response) {
                if (response.status === 'OK') {
                    var modalInstance = $modal.open({
                        templateUrl: 'app/components/main/view/modal/fileApps.html',
                        controller: 'FileAppsModalController',
                        resolve: {
                            apps: function () {
                                return response.data;
                            }
                        }
                    });
                } else {
                    alertService.showAlertMessage(localization.localize(response.message));
                }
            })
        };

        $scope.init();
    })
    .controller('FileAppsModalController', function ($scope, $modalInstance, apps) {
        $scope.apps = apps;

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }
    })
    .controller('FileModalController', function ($scope, $modalInstance, fileService, file, localization) {
        $scope.file = file !== null ? angular.copy(file, {}) : {};

        fileService.getLimit(function(response) {
            if (response.status === 'OK' &&
                response.data.sizeLimit > 0) {
                var availableSpace = response.data.sizeLimit - response.data.sizeUsed;
                if (availableSpace < 0) {
                    availableSpace = 0;
                }
                if (availableSpace < 20) {
                    $scope.availableSpace = localization.localize('form.file.available')
                        .replaceAll('${space}', availableSpace);
                }
            }
        });

        $scope.save = function () {
            $scope.errorMessage = '';
            $scope.successMessage = '';

            if (!$scope.file.id && !$scope.file.tmpPath && !$scope.file.external) {
                $scope.errorMessage = localization.localize('error.file.empty');
            } else {
                var request = {};
                for (var prop in $scope.file) {
                    if ($scope.file.hasOwnProperty(prop)) {
                        request[prop] = $scope.file[prop];
                    }
                }

                $scope.loading = true;
                fileService.updateFile(request, function (response) {
                    $scope.loading = false;
                    if (response.status === 'OK') {
                        $modalInstance.close(response.data);
                    } else {
                        $scope.errorMessage = localization.localize(response.message);
                    }
                }, function () {
                    $scope.loading = false;
                    $scope.errorMessage = localization.localize('error.request.failure');
                });
            }
        };

        $scope.onStartedUpload = function () {
            $scope.loading = true;
            $scope.uploadProgressPercent = 0;
        };

        $scope.onUploadProgress = function(progress) {
            var loadedMb = (progress.loaded / 1048576).toFixed(1);
            var totalMb = (progress.total / 1048576).toFixed(1);
            $scope.uploadProgressPercent = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;
            $scope.successMessage = localization.localize('success.uploading.file') +
                " " + loadedMb + " / " + totalMb + " Mb";
        };

        $scope.fileUploaded = function (response) {
            $scope.errorMessage = '';
            $scope.successMessage = '';

            $scope.loading = false;

            if (response.data.status === 'OK') {
                $scope.file.filePath = response.data.data.name;
                $scope.file.devicePath = "/Download/" + response.data.data.name;
                $scope.file.tmpPath = response.data.data.serverPath;
                $scope.successMessage = localization.localize('success.file.uploaded');
            } else if (response.data.message == 'error.size.limit.exceeded') {
                $scope.errorMessage = localization.localize(response.data.message) + ' (' + response.data.data + ' Mb)';
            } else {
                $scope.errorMessage = localization.localize(response.data.message);
            }
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }
    })
    .controller('FileConfigurationsModalController', function ($scope, $modalInstance, fileService, file, localization) {
        $scope.file = angular.copy(file);

        var loadData = function () {
            fileService.getConfigurations({"id": file.id}, function (response) {
                if (response.data) {
                    $scope.configurations = response.data;
                }
            });
        };
        $scope.file.fileName = file.description ? file.description :
            (file.external ? file.url : file.filePath);

        $scope.configurations = [];
        loadData();

        $scope.selectionChanged = function(configuration) {
            configuration.notify = true;
        };

        $scope.save = function () {
            $scope.errorMessage = '';

            var request = {"fileId": file.id};

            var configurations = [];
            for (var i = 0; i < $scope.configurations.length; i++) {
                configurations.push($scope.configurations[i]);
            }

            request.configurations = configurations;

            fileService.updateConfigurations(request, function (response) {
                if (response.status === 'OK') {
                    $modalInstance.close();
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            });
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }

    });