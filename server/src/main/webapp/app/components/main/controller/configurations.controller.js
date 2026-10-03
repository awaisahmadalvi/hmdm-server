// Localization completed
angular.module('headwind-kiosk')
    .controller('ConfigurationsTabController', function ($scope, $rootScope, $state, $modal, confirmModal,
                                                         configurationService, authService, $window, localization,
                                                         alertService, hintService, $timeout) {
        $scope.isTypical = false;

        $scope.paging = {
            currentPage: 1,
            pageSize: 50
        };

        $scope.searchObj = {
            searchValue: null
        };

        $scope.$watch('paging.currentPage', function () {
            $window.scrollTo(0, 0);
        });

        $scope.hasPermission = authService.hasPermission;

        $scope.qrCodeAvailable = function (configuration) {
            return configuration.qrCodeKey && configuration.mainAppId > 0 && configuration.eventReceivingComponent &&
                configuration.eventReceivingComponent.length > 0;
        };

        $scope.showQrCode = function (configuration) {
            var url = configuration.baseUrl + "/#/qr/" + configuration.qrCodeKey + "/?name=" + encodeURIComponent(configuration.name);
            $window.open(url, "_self");
        };

        $scope.configurationsToast = null;
        var showConfigurationsToast = function (type, message, action) {
            $scope.configurationsToast = { type: type, message: message, action: action };
            $timeout(function () {
                if ($scope.configurationsToast && $scope.configurationsToast.message === message) {
                    $scope.configurationsToast = null;
                }
            }, 4000);
        };

        $scope.loading = true;
        $scope.init = function (isTypical) {
            $rootScope.settingsTabActive = false;
            $rootScope.pluginsTabActive = false;
            $scope.paging.currentPage = 1;
            $scope.isTypical = isTypical;

            // The configuration editor sets $rootScope.configurationsMessage as a
            // one-time flash message on save (see ConfigurationEditorController's
            // save()/close()) - previously rendered via <notification-message>,
            // now shown through this page's own toast for visual consistency.
            if ($rootScope.configurationsMessage) {
                showConfigurationsToast('success', $rootScope.configurationsMessage);
                $rootScope.configurationsMessage = undefined;
            }

            $scope.search(function () {
                // Hints are shown after all configurations are loaded
                $timeout(function () {
                    // Onboarding hint in the configuration tab is no more needed
//                    hintService.onStateChangeSuccess();
                }, 300);
            });
        };

        $scope.search = function (callback) {
            $scope.loading = true;
            var onResponse = function (response) {
                $scope.loading = false;
                $scope.configurations = response.data;
                if (callback) {
                    callback();
                }
            };
            var onError = function () {
                $scope.loading = false;
            };
            if ($scope.isTypical) {
                configurationService.getAllTypicalConfigurations({value: $scope.searchObj.searchValue}, onResponse, onError);
            } else {
                configurationService.getAllConfigurations({value: $scope.searchObj.searchValue}, onResponse, onError);
            }
        };

        $scope.clearSearch = function () {
            $scope.searchObj.searchValue = '';
            $scope.search();
        };

        // Live search: debounce while typing, same search() Enter already
        // triggers - not a separate search path (established pattern, see
        // Groups/Icons/Users/Files pages).
        var searchDebounceTimer = null;
        $scope.$watch('searchObj.searchValue', function (newVal, oldVal) {
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

        $scope.addConfiguration = function() {
            confirmModal.getUserConfirmation(localization.localize('configuration.add.warning'), function () {
                $scope.editConfiguration({"id": 0});
            });
        };

        $scope.editConfiguration = function (configuration) {

            // $state.goNewTab('configEditor', {"id": configuration.id, "typical": $scope.isTypical});
            $state.transitionTo('configEditor', {"id": configuration.id, "typical": $scope.isTypical});

        };

        $scope.copyConfiguration = function (configuration) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/copyConfiguration.html',
                controller: 'CopyConfigurationModalController',
                resolve: {
                    configuration: function () {
                        return configuration;
                    }
                }
            });

            modalInstance.result.then(function (newName) {
                $scope.search(function () {
                    var openAction = null;
                    var newConfiguration = $scope.configurations.find(function (c) {
                        return c.name === newName;
                    });
                    if (newConfiguration) {
                        openAction = {
                            label: localization.localize('form.configurations.action.open'),
                            onClick: function () {
                                $scope.editConfiguration(newConfiguration);
                            }
                        };
                    }
                    showConfigurationsToast('success', localization.localize('success.configuration.copied'), openAction);
                });
            });
        };

        $scope.removeConfiguration = function (configuration) {
            let localizedText = $scope.configurations.length > 1 ?
                localization.localize('question.delete.configuration').replace('${configurationName}', configuration.name) :
                localization.localize('configuration.remove.warning');
            confirmModal.getUserConfirmation(localizedText, function () {
                configurationService.removeConfiguration({id: configuration.id}, function (response) {
                    if (response.status === 'OK') {
                        $scope.search();
                        showConfigurationsToast('success', localization.localize('success.configuration.deleted'));
                    } else {
                        alertService.showAlertMessage(localization.localize(response.message));
                        showConfigurationsToast('error', localization.localize(response.message));
                    }
                }, alertService.onRequestFailure);
            });
        };

        $scope.init(false);
    })
    .controller('CopyConfigurationModalController',
        function ($scope, $modalInstance, configurationService, configuration, localization) {

            $scope.configuration = {
                "id": configuration.id,
                "name": configuration.name ? configuration.name + localization.localize('form.configuration.copy.suffix') : '',
                "description": configuration.description
            };
            $scope.saving = false;

            $scope.save = function () {
                $scope.saveInternal();
            };

            $scope.saveInternal = function () {
                $scope.errorMessage = '';

                if (!$scope.configuration.name) {
                    $scope.errorMessage = localization.localize('error.empty.configuration.name');
                } else {
                    var request = {
                        "id": $scope.configuration.id,
                        "name": $scope.configuration.name,
                        "description": $scope.configuration.description
                    };
                    $scope.saving = true;
                    configurationService.copyConfiguration(request, function (response) {
                        $scope.saving = false;
                        if (response.status === 'OK') {
                            $modalInstance.close($scope.configuration.name);
                        } else {
                            $scope.errorMessage = localization.localize('error.duplicate.configuration.name');
                        }
                    }, function () {
                        $scope.saving = false;
                        $scope.errorMessage = localization.localize('error.request.failure');
                    });
                }
            };

            $scope.closeModal = function () {
                $modalInstance.dismiss();
            }
        })
    .controller('ApplicationSettingEditorController', function ($scope, $modalInstance, localization,
                                                                applicationSetting, getApps) {
        var copy = {};
        for (var p in applicationSetting) {
            if (applicationSetting.hasOwnProperty(p)) {
                copy[p] = applicationSetting[p];
            }
        }

        $scope.applicationSetting = copy;
        $scope.mainApp = null;
        $scope.errorMessage = undefined;

        // applicationId is also set (with no id/tempId) when opening this
        // dialog from a specific app's "Add setting to this app" link, to
        // preselect that app on an otherwise-new setting.
        if (applicationSetting.id || applicationSetting.tempId || applicationSetting.applicationId) {
            $scope.mainApp = {
                id: applicationSetting.applicationId,
                name: applicationSetting.applicationName,
                pkg: applicationSetting.applicationPkg
            };
        }

        $scope.appLookupFormatter = function (val) {
            if (val) {
                return val.pkg;
            } else {
                return null;
            }
        };

        $scope.onMainAppSelected = function ($item) {
            $scope.mainApp = $item;
        };

        $scope.getApps = getApps;

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };

        $scope.save = function () {
            $scope.errorMessage = undefined;

            if (!$scope.applicationSetting.name) {
                $scope.errorMessage = localization.localize('error.application.setting.empty.name');
                // } else if (!$scope.applicationSetting.value) {
                //     $scope.errorMessage = localization.localize('error.application.setting.empty.value');
            } else if (!$scope.mainApp || !$scope.mainApp.id) {
                $scope.errorMessage = localization.localize('error.application.setting.empty.app');
            } else {

                $scope.applicationSetting.applicationPkg = $scope.mainApp.pkg;
                $scope.applicationSetting.applicationName = $scope.mainApp.name;
                $scope.applicationSetting.applicationId = $scope.mainApp.id;
                $scope.applicationSetting.lastUpdate = new Date().getTime();

                $modalInstance.close($scope.applicationSetting);
            }
        };
    })
    .controller('AddConfigurationAppModalController', function ($scope, localization, configurationService, authService,
                                                                applications, configuration, $modalInstance, $modal) {

        // TODO : ISV : Update this controller
        // $scope.mainAppSelected = false;
        $scope.mainApp = {id: -1, name: ""};

        $scope.hasPermission = authService.hasPermission;

        $scope.appLookupFormatter = function (val) {
            return val.name + (val.version && val.version !== '0' ? " " + val.version : "");
        };

        // $scope.trackMainApp = function (val) {
        //     $scope.mainAppSelected = val;
        // };

        $scope.onMainAppSelected = function ($item) {
            $scope.mainApp = $item;
            $scope.mainApp.action = 1;
        };

        $scope.getApps = function (filter) {
            var lower = filter.toLowerCase();

            var apps = $scope.availableApplications.filter(function (app) {
                // Here we select all apps including web because this function is used to add a new app to the desktop
                // Intentionally using app.action == 1 but not app.action === 1
                return (app.name.toLowerCase().indexOf(lower) > -1
                    || app.pkg && app.pkg.toLowerCase().indexOf(lower) > -1
                    || app.version && app.version.toLowerCase().indexOf(lower) > -1);
            });

            apps.sort(function (a, b) {
                let n1 = a.name.toLowerCase();
                let n2 = b.name.toLowerCase();

                if (n1 === n2) {
                    return 0;
                } else if (n1 < n2) {
                    return -1;
                } else {
                    return 1;
                }
            });

            return apps;
        };

        $scope.availableApplications = applications.filter(function (app) {
            return app.action == '0' && !app.actionChanged;
        });

        $scope.showIconSelectOptions = [
            {id: true, label: localization.localize('form.configuration.apps.label.show')},
            {id: false, label: localization.localize('form.configuration.apps.label.not.show')},
        ];

        $scope.isInstallOptionAvailable = function (application) {
            return !application.system && application.type === 'app' && (application.url || application.urlArm64 || application.urlArmeabi);
        };
        $scope.isRemoveOptionAvailable = function (application) {
            return !application.system &&  application.type === 'app';
        };
        $scope.actionChanged = function (application) {
            application.remove = (application.action == '2');
        };

        $scope.configuration = configuration;

        $scope.save = function () {
            $modalInstance.close($scope.mainApp);
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };

        $scope.newApp = function () {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/application.html',
                controller: 'ApplicationModalController',
                windowClass: 'app-modal-wide',
                resolve: {
                    application: function () {
                        return {};
                    },
                    isControlPanel: function () {
                        return false;
                    },
                    closeOnSave: function () {
                        return true;
                    },
                    pendingFile: function () {
                        return null;
                    }
                }
            });

            modalInstance.result.then(function (addedApp) {
                addedApp.isNew = true;
                $scope.mainApp = addedApp;
                $scope.mainApp.action = 1;
            });
        };
    })
    .controller('ConfigurationEditorController',
        function ($scope, configurationService, settingsService, $stateParams, $state, $rootScope, $window, $timeout,
                  $transitions, localization, confirmModal, alertService, $modal, appVersionComparisonService, settingsService) {

            $scope.successMessage = null;

            let sortItem = $window.localStorage.getItem('HMDM_configAppsSortBy');
            $scope.sort = {
                by: ((sortItem !== null && sortItem !== undefined) ? sortItem : 'name')
            };

            $scope.pkgInfoVisible = function (application) {
                return application.type === 'app';
            };

            $scope.saveButtonClass = function () {
                return $scope.configurationForm.$dirty ? 'btn-attention' : '';
            };

            // Editor shell: which of the 6 tabs is active (0 = Common
            // Settings ... 5 = Files, matching their order below), the
            // save toast, and the QR button (same qrCodeAvailable/
            // showQrCode logic as the Configurations list page, but using
            // the live mainApp selection rather than the last-saved
            // mainAppId since this page may have unsaved changes).
            // ?tab=N (see app.js's configEditor state) lets another page -
            // e.g. an application's "Configurations using this app" dialog -
            // deep-link straight to a specific tab (2 = Applications)
            // instead of always landing on Common Settings.
            var initialTab = parseInt($stateParams.tab, 10);
            $scope.activeConfigTab = (initialTab >= 0 && initialTab <= 5) ? initialTab : 0;

            $scope.configEditorToast = null;
            var showConfigEditorToast = function (type, message) {
                $scope.configEditorToast = { type: type, message: message };
                $timeout(function () {
                    if ($scope.configEditorToast && $scope.configEditorToast.message === message) {
                        $scope.configEditorToast = null;
                    }
                }, 3000);
            };

            $scope.qrCodeAvailable = function () {
                return $scope.configuration.qrCodeKey && $scope.mainApp.id > 0 && $scope.configuration.eventReceivingComponent &&
                    $scope.configuration.eventReceivingComponent.length > 0;
            };

            $scope.showQrCode = function () {
                var url = $scope.configuration.baseUrl + "/#/qr/" + $scope.configuration.qrCodeKey + "/?name=" + encodeURIComponent($scope.configuration.name);
                $window.open(url, "_self");
            };

            $scope.qrUrlIsLocalhost = function () {
                var url = ($scope.configuration.baseUrl || '').toLowerCase();
                return url.indexOf('localhost') > -1 || url.indexOf('127.0.0.1') > -1;
            };

            // Sticky section nav factory - identical IntersectionObserver-
            // based approach as the General settings page (settings.
            // controller.js), generalized so every editor tab with its own
            // section nav (Common Settings, MDM Settings, ...) gets one
            // without re-implementing the observer/scroll-suppression
            // wiring each time. Returns the scrollTo(id) function to bind
            // as that tab's $scope.scrollToXSection.
            var makeSectionScrollspy = function (config) {
                // config: {idPrefix, sectionIds, scrollOffset, tabIndex, activeProp}
                $scope[config.activeProp] = config.sectionIds[0];

                var suppressAuto = false;
                var suppressTimeout = null;

                var scrollTo = function (id) {
                    $scope[config.activeProp] = id;
                    suppressAuto = true;
                    if (suppressTimeout) {
                        $timeout.cancel(suppressTimeout);
                    }
                    suppressTimeout = $timeout(function () {
                        suppressAuto = false;
                    }, 1000);
                    var el = document.getElementById(config.idPrefix + id);
                    if (el) {
                        $window.scrollTo({ top: el.offsetTop - config.scrollOffset, behavior: 'smooth' });
                    }
                };

                var visibility = {};
                var observer = null;

                if ($window.IntersectionObserver) {
                    observer = new IntersectionObserver(function (entries) {
                        entries.forEach(function (entry) {
                            var id = entry.target.id.replace(config.idPrefix, '');
                            visibility[id] = entry.isIntersecting;
                        });
                        if (suppressAuto) {
                            return;
                        }
                        var current = null;
                        config.sectionIds.forEach(function (id) {
                            if (visibility[id]) {
                                current = id;
                            }
                        });
                        if (current && $scope[config.activeProp] !== current) {
                            $scope.$apply(function () {
                                $scope[config.activeProp] = current;
                            });
                        }
                    }, {
                        rootMargin: '-' + config.scrollOffset + 'px 0px -70% 0px',
                        threshold: 0
                    });

                    $timeout(function () {
                        if ($scope.activeConfigTab !== config.tabIndex) {
                            return;
                        }
                        config.sectionIds.forEach(function (id) {
                            var el = document.getElementById(config.idPrefix + id);
                            if (el) {
                                observer.observe(el);
                            }
                        });
                    });
                }

                var onScrollBottom = function () {
                    if (suppressAuto || $scope.activeConfigTab !== config.tabIndex) {
                        return;
                    }
                    var atBottom = $window.scrollY + $window.innerHeight >= document.documentElement.scrollHeight - 2;
                    if (!atBottom) {
                        return;
                    }
                    var last = config.sectionIds[config.sectionIds.length - 1];
                    if (last && $scope[config.activeProp] !== last) {
                        $scope.$apply(function () {
                            $scope[config.activeProp] = last;
                        });
                    }
                };
                angular.element($window).on('scroll', onScrollBottom);
                $scope.$on('$destroy', function () {
                    angular.element($window).off('scroll', onScrollBottom);
                    if (observer) {
                        observer.disconnect();
                    }
                });

                return scrollTo;
            };

            var COMMON_SECTION_IDS = ['general', 'connectivity', 'hardware', 'display', 'updates', 'security', 'launcher'];
            $scope.scrollToCommonSection = makeSectionScrollspy({
                idPrefix: 'common-section-',
                sectionIds: COMMON_SECTION_IDS,
                scrollOffset: 140, // clears the sticky page header + tabs
                tabIndex: 0,
                activeProp: 'commonActiveSection'
            });

            var MDM_SECTION_IDS = ['kiosk', 'agent', 'enrollment', 'policy', 'migration'];
            $scope.scrollToMdmSection = makeSectionScrollspy({
                idPrefix: 'mdm-section-',
                sectionIds: MDM_SECTION_IDS,
                scrollOffset: 140,
                tabIndex: 3,
                activeProp: 'mdmActiveSection'
            });

            $scope.uploadBackground = function () {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/file.html',
                    // Defined in files.controller.js
                    controller: 'FileModalController',
                    resolve: {
                        // FileModalController requires this resolve (see its
                        // signature in files.controller.js) - without it,
                        // opening the modal throws "Unknown provider: file"
                        // and silently never opens. Pre-existing bug, found
                        // while wiring the same modal from the Icons page.
                        file: function () {
                            return null;
                        }
                    }
                });

                modalInstance.result.then(function (data) {
                    if (data) {
                        $scope.designModel.backgroundImageUrl = data.url;
                    }
                });
            };

            $scope.removeBackgroundImage = function () {
                $scope.designModel.backgroundImageUrl = '';
            };

            $scope.backgroundImageFileName = function () {
                var url = $scope.designModel && $scope.designModel.backgroundImageUrl;
                if (!url) {
                    return '';
                }
                var parts = url.split('/');
                return parts[parts.length - 1] || url;
            };

            var DESIGN_HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

            $scope.isValidHex = function (value) {
                return !value || DESIGN_HEX_COLOR_RE.test(value);
            };

            $scope.designColorPresets = [
                {label: localization.localize('form.settings.design.color.preset.navy'), value: '#0f172a'},
                {label: localization.localize('form.settings.design.color.preset.white'), value: '#ffffff'},
                {label: localization.localize('form.settings.design.color.preset.black'), value: '#000000'}
            ];

            $scope.applyColorPreset = function (field, value) {
                $scope.designModel[field] = value;
            };

            // See settings.controller.js's identical helper for why the
            // swatch is mirrored through a normalized proxy rather than
            // bound directly to the real (possibly 3-digit/empty/invalid)
            // hex field.
            var expandDesignHex = function (value) {
                if (!DESIGN_HEX_COLOR_RE.test(value || '')) {
                    return null;
                }
                if (value.length === 4) {
                    return '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
                }
                return value.toLowerCase();
            };

            $scope.colorSwatchProxy = {};

            var syncDesignSwatchProxy = function (field, fallback) {
                // designModel isn't assigned until the syncDesignModel watch
                // below has run at least once - this watch is registered
                // earlier, so on the very first digest it can fire first,
                // while designModel is still undefined.
                $scope.colorSwatchProxy[field] = (($scope.designModel && expandDesignHex($scope.designModel[field])) || fallback);
            };

            $scope.$watch('designModel.backgroundColor', function () {
                syncDesignSwatchProxy('backgroundColor', '#0f172a');
            });
            $scope.$watch('designModel.textColor', function () {
                syncDesignSwatchProxy('textColor', '#ffffff');
            });

            $scope.applySwatchColor = function (field) {
                $scope.designModel[field] = $scope.colorSwatchProxy[field];
            };

            $scope.previewColor = function (value, fallback) {
                return $scope.isValidHex(value) && value ? value : fallback;
            };

            $scope.iconSizePreviewClass = function () {
                var size = $scope.designModel && $scope.designModel.iconSize;
                if (size === 'LARGE') {
                    return 'design-preview-icon-large';
                }
                if (size === 'MEDIUM') {
                    return 'design-preview-icon-medium';
                }
                return 'design-preview-icon-small';
            };

            $scope.previewHeaderText = function () {
                var header = $scope.designModel && $scope.designModel.desktopHeader;
                switch (header) {
                    case 'DEVICE_ID':
                        return localization.localize('form.settings.design.preview.header.deviceid');
                    case 'DESCRIPTION':
                        return localization.localize('form.settings.design.preview.header.description');
                    case 'TEMPLATE':
                        return $scope.designModel.desktopHeaderTemplate || localization.localize('form.settings.design.preview.header.custom');
                    case 'CUSTOM1':
                    case 'CUSTOM2':
                    case 'CUSTOM3':
                        return localization.localize('form.settings.design.preview.header.custom');
                    default:
                        return '';
                }
            };

            // $scope.designModel points at whichever object the Design
            // Settings tab's form/preview should currently reflect: the
            // global default-design object while "Use default design" is
            // on (read-only there), or this configuration's own fields
            // while it's off (editable) - shared with the Default Design
            // settings page via designFormFields.html/designPreview.html.
            var syncDesignModel = function () {
                $scope.designModel = ($scope.configuration.useDefaultDesignSettings && $scope.settings)
                    ? $scope.settings : $scope.configuration;
            };
            $scope.$watch('configuration.useDefaultDesignSettings', syncDesignModel);
            $scope.$watch('configuration', syncDesignModel);
            $scope.$watch('settings', syncDesignModel);

            // If the custom fields are still empty when switching "Use
            // default design" off, prefill them from the default design so
            // the form doesn't start out blank - a convenience default only;
            // it doesn't change what gets saved (an empty field here would
            // have taken the default design's own value anyway until the
            // user edits it).
            $scope.onDesignDefaultToggle = function () {
                if (!$scope.configuration.useDefaultDesignSettings && $scope.settings) {
                    ['backgroundColor', 'textColor', 'backgroundImageUrl', 'iconSize', 'desktopHeader'].forEach(function (field) {
                        if (!$scope.configuration[field]) {
                            $scope.configuration[field] = $scope.settings[field];
                        }
                    });
                }
            };

            $scope.localizeRenewVersionTitle = function (application) {
                let localizedText = localization.localize('configuration.app.version.upgrade.message')
                    .replace('${installedVersion}', application.version)
                    .replace('${latestVersion}', application.latestVersionText);

                return localizedText;
            };

            $scope.localizePermissiveLockedTitle = localization.localize('form.configuration.settings.mdm.permissive.locked');

            $scope.filterApps = function (item) {
                var filter = ($scope.paging.filterText || '').toLowerCase();

                var matchesText = (item.name && item.name.toLowerCase().indexOf(filter) >= 0)
                    || (item.type === 'app' && item.pkg && item.pkg.toLowerCase().indexOf(filter) >= 0);
                var matchesActionFilter = $scope.appActionFilter === 'all' || $scope.appActionGroup(item) === $scope.appActionFilter;

                return matchesText && matchesActionFilter;
            };

            $scope.splitApkWarning = function(application) {
                if (application.type != 'app') {
                    return null;
                }
                if (application.split && application.urlArmeabi && !application.urlArm64) {
                    return localization.localize('form.application.arch.warning').replace('${arch}', "armeabi-v7a");
                }
                if (application.split && !application.urlArmeabi && application.urlArm64) {
                    return localization.localize('form.application.arch.warning').replace('${arch}', "arm64-v8a");
                }
                return null;
            };

            $scope.checkNetworkState = function() {
                if ($scope.configuration.wifi === false && $scope.configuration.mobileData === false) {
                    alertService.showAlertMessage(localization.localize('form.configuration.settings.common.no.network.warning'));
                }
            };

            $scope.addApp = function () {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/addConfigurationApplication.html',
                    controller: 'AddConfigurationAppModalController',
                    resolve: {
                        applications: function () {
                            return allApplications;
                        },
                        configuration: function () {
                            return $scope.configuration;
                        }
                    }
                });

                // TODO : ISV : need to re-caclculate mainappid, contentappid if necessary
                modalInstance.result.then(function (addedApp) {
                    if (addedApp) {
                        addedApp.actionChanged = true;
                        var addedAppIsToBeUsed = addedApp.action == 1;
                        if (addedAppIsToBeUsed) {
                            $scope.applications.filter(function (app) {
                                return app.pkg === addedApp.pkg && (app.action == 1);
                            }).forEach(function (app) {
                                app.action = 0;
                            });
                        }
                        if (addedApp.isNew) {
                            allApplications.push(addedApp);
                        }
                        $scope.applications.push(addedApp);
                        if (!addedApp.usedVersionId) {
                            addedApp.usedVersionId = addedApp.latestVersion;
                        }

                        if (addedAppIsToBeUsed) {
                            syncMainApp();
                            syncContentApp();
                        }
                    }
                });
            };

            $scope.actionChanged = function (updatedApp) {
                updatedApp.actionChanged = true;
                if (updatedApp.action == 1) {
                    $scope.applications.filter(function (app) {
                        return updatedApp != app && app.pkg === updatedApp.pkg && (app.action == 1);
                    }).forEach(function (app) {
                        app.action = 0;
                    });
                }
            };

            $scope.pushOptionsChanged = function() {
                updateMqttHint();
            };

            var updateMqttHint = function() {
                if ($scope.configuration.pushOptions === 'mqttWorker') {
                    $scope.pushHint = localization.localize('form.configuration.settings.push.options.mqtt.worker.hint');
                } else if ($scope.configuration.pushOptions === 'mqttAlarm') {
                    $scope.pushHint = localization.localize('form.configuration.settings.push.options.mqtt.alarm.hint');
                } else if ($scope.configuration.pushOptions === 'polling') {
                    $scope.pushHint = localization.localize('form.configuration.settings.push.options.polling.hint');
                } else {
                    $scope.pushHint = '';
                }
            };

            $scope.upgrading = false;
            $scope.upgradeApp = function (application) {
                if ($scope.upgrading) {
                    // Prevent multiple clicks, because this somehow clears the app being upgraded
                    return;
                }
                let localizedText = localization.localize('question.app.upgrade')
                    .replace('${v1}', application.name)
                    .replace('${v2}', $scope.configuration.name);
                confirmModal.getUserConfirmation(localizedText, function () {
                    $scope.upgrading = true;
                    configurationService.upgradeConfigurationApplication(
                        {configurationId: $scope.configuration.id, applicationId: application.id}, function (response) {
                            $scope.upgrading = false;
                            if (response.status === 'OK') {
                                $scope.configuration.mainAppId = response.data.mainAppId;
                                $scope.configuration.contentAppId = response.data.contentAppId;

                                $scope.loadApps($scope.configuration.id);
                            } else {
                                alertService.showAlertMessage(localization.localize(response.message));
                            }
                        }, function (response) {
                            $scope.upgrading = false;
                            console.error("Error when sending request to server", response);
                            showAlert(localization.localize('error.request.failure'));
                        });
                });
            };

            $scope.showIconSelectOptions = [
                {id: true, label: localization.localize('form.configuration.apps.label.show')},
                {id: false, label: localization.localize('form.configuration.apps.label.not.show')},
            ];

            $scope.isInstallOptionAvailable = function (application) {
                return !application.system && application.type === 'app' && (application.url || application.urlArm64 || application.urlArmeabi);
            };
            $scope.isRemoveOptionAvailable = function (application) {
                return !application.system && application.type === 'app';
            };

            // Groups an app's raw action value (0/1/2) together with the
            // isInstallOptionAvailable() flag that already decides which of
            // two labels a 0 or 1 gets shown as (Block vs Do not install,
            // Install vs Allow) - the Action pill's color and the toolbar's
            // filter pills both key off this same grouping so they agree
            // with whatever label each row is actually showing.
            $scope.appActionGroup = function (application) {
                if (application.action == 1) {
                    return 'install';
                }
                if (application.action == 0) {
                    return $scope.isInstallOptionAvailable(application) ? 'not-install' : 'block';
                }
                return 'delete';
            };

            $scope.appActionFilter = 'all';

            $scope.setAppActionFilter = function (key) {
                $scope.appActionFilter = key;
            };

            // Only offers a filter pill for a group that actually has at
            // least one matching app right now (client-side only).
            $scope.appActionFilters = function () {
                var groups = [
                    {key: 'install', label: localization.localize('form.configuration.apps.action.install')},
                    {key: 'not-install', label: localization.localize('form.configuration.apps.action.not.install')},
                    {key: 'block', label: localization.localize('form.configuration.apps.action.prohibit')},
                    {key: 'delete', label: localization.localize('form.configuration.apps.action.delete')}
                ];
                var present = {};
                ($scope.applications || []).forEach(function (app) {
                    present[$scope.appActionGroup(app)] = true;
                });
                return groups.filter(function (group) {
                    return present[group.key];
                });
            };

            // Client-side only, computed from the same $scope.applications
            // array the table already renders - doesn't touch what's saved.
            $scope.appsSummary = function () {
                var apps = $scope.applications || [];
                var install = 0, home = 0, blocked = 0;
                apps.forEach(function (app) {
                    if (app.action == 1) {
                        install++;
                        if (app.showIcon) {
                            home++;
                        }
                    } else if ($scope.appActionGroup(app) === 'block') {
                        blocked++;
                    }
                });
                return {total: apps.length, install: install, home: home, blocked: blocked};
            };

            $scope.appsHintDismissed = false;
            $scope.dismissAppsHint = function () {
                $scope.appsHintDismissed = true;
            };

            // appActionFilters()/appsSummary() both build a brand new array/
            // object every call. Calling them directly from an ng-repeat/
            // interpolation would hand Angular a new reference every single
            // digest, which for the ng-repeat specifically never stabilizes
            // ($rootScope:infdig, confirmed by reproducing it live - the
            // whole app fell back to the root state on any Applications-tab
            // render). Cache their output here instead and only recompute
            // when the underlying data actually (deep-)changes; the template
            // reads the cached appActionFilterOptions/appsSummaryData.
            $scope.appActionFilterOptions = [];
            $scope.appsSummaryData = {total: 0, install: 0, home: 0, blocked: 0};
            $scope.$watch('applications', function () {
                $scope.appActionFilterOptions = $scope.appActionFilters();
                $scope.appsSummaryData = $scope.appsSummary();
            }, true);

            $scope.resetAppsFilters = function () {
                $scope.paging.filterText = '';
                $scope.appActionFilter = 'all';
            };

            $scope.desktopHeaderTemplatePlaceholder = localization.localize('form.configuration.settings.design.desktop.header.template.placeholder') + ' deviceId, description, custom1, custom2, custom3';

            var transFunction = function(trans) {
                if ($scope.configurationForm && $scope.configurationForm.$dirty) {
                    if (!$scope.saved) {
                        var confirmed = confirm(localization.localize('question.exit.without.saving'));
                        if (!confirmed) {
                            $transitions.onStart({ }, transFunction, {invokeLimit: 1});
                            return false;
                        }
                    }
                }
            }
            $transitions.onStart({ }, transFunction, {invokeLimit: 1});

            // $scope.saved is a one-shot flag meant only to let the Save-and-
            // close flow's own transitionTo() through without re-prompting
            // (dirty is still true at that point since it's cleared only in
            // the non-close save branch above). Without this watch it stays
            // true forever after any successful save, permanently disabling
            // the unsaved-changes prompt for edits made later in the same
            // visit - reset it as soon as the form goes dirty again.
            $scope.$watch('configurationForm.$dirty', function (dirty) {
                if (dirty) {
                    $scope.saved = false;
                }
            });

            $scope.sortByChanged = function () {
                $window.localStorage.setItem('HMDM_configAppsSortBy', $scope.sort.by);
                $scope.paging.currentPage = 1;
            };

            $scope.getApps = function (filter) {
                var lower = filter.toLowerCase();
                var apps = allApplications.filter(function (app) {
                    // Here we select only native apps because this function is used to select main and content apps
                    // Intentionally using app.action == 1 but not app.action === 1
                    return app.type === 'app' && (app.action == 1) && (app.name.toLowerCase().indexOf(lower) > -1
                        || app.pkg && app.pkg.toLowerCase().indexOf(lower) > -1
                        || app.version && app.version.toLowerCase().indexOf(lower) > -1);
                });

                apps.sort(function (a, b) {
                    let n1 = a.name.toLowerCase();
                    let n2 = b.name.toLowerCase();

                    if (n1 === n2) {
                        return 0;
                    } else if (n1 < n2) {
                        return -1;
                    } else {
                        return 1;
                    }
                });

                return apps;
            };

            $scope.onMainAppSelected = function ($item) {
                $scope.mainApp = $item;
                bConfigurationWasLost = false;
            };
            $scope.onContentAppSelected = function ($item) {
                $scope.contentApp = $item;
            };
            $scope.trackMainApp = function (val) {
                mainAppSelected = val;
            };
            $scope.trackContentApp = function (val) {
                contentAppSelected = val;
            };

            $scope.appLookupFormatter = function (val) {
                return val.name + (val.version && val.version !== '0' ? " " + val.version : "");
            };

            var getAppSettingsApps = function (filter) {
                var lower = filter.toLowerCase();
                var apps = allApplications.filter(function (app) {
                    // Intentionally using app.action == 1 but not app.action === 1
                    return app.type === 'app' && (app.name.toLowerCase().indexOf(lower) > -1
                        || app.pkg && app.pkg.toLowerCase().indexOf(lower) > -1
                        || app.version && app.version.toLowerCase().indexOf(lower) > -1);
                });

                apps.sort(function (a, b) {
                    let n1 = a.name.toLowerCase();
                    let n2 = b.name.toLowerCase();

                    if (n1 === n2) {
                        return 0;
                    } else if (n1 < n2) {
                        return -1;
                    } else {
                        return 1;
                    }
                });

                return apps;
            };

            $scope.getAppSettingsApps = getAppSettingsApps;

            $scope.onAppSettingsFilterAppSelected = function ($item) {
                $scope.settingsPaging.appSettingsFilterApp = $item;
                $scope.settingsPaging.appSettingsAppFilterText = $item.pkg;
                filterApplicationSettings();
            };

            $scope.appSettingsAppLookupFormatter = function (val) {
                if (val) {
                    return val.pkg;
                } else {
                    return null;
                }
            };

            $scope.appSettingsFilterChanged = function () {
                filterApplicationSettings();
            };

            $scope.filesFilterChanged = function () {
                filterFiles();
            };

            $scope.systemAppsToggled = function () {
                $scope.showSystemApps = !$scope.showSystemApps;
                $window.localStorage.setItem('HMDM_configShowSystemApps', $scope.showSystemApps);
                $scope.applications = allApplications.filter(function (app) {
                    return (app.actionChanged || app.action != '0') && (!app.system || $scope.showSystemApps);
                });
            };

            $scope.loadApps = function (configId) {
                configurationService.getApplications({"id": configId}, function (response) {
                    if (response.status === 'OK') {
                        setTimeout(function () {
                            // Workaround against occasional loss of mainAppId due to AngularJS Digest Cycle
                            // Thanks to @GlebMan-n
                            response.data.forEach(function (app) {
                                app.actionChanged = false;
                            });

                            allApplications = response.data.map(function (app) {
                                return app;
                            });
                            $scope.applications = response.data.filter(function (app) {
                                // Application com.hmdm.launcher is made available by default when creating new configuration
                                return app.action != '0' && (!app.system || $scope.showSystemApps) || (!configId && app.pkg === 'com.hmdm.launcher' && app.action != '2');
                            });

                            // For new configuration use default app for main app and content receiver
                            if (!configId) {
                                let mainAppCandidates = response.data.filter(function (app) {
                                    return app.pkg === 'com.hmdm.launcher' && app.action != '2';
                                });

                                if (mainAppCandidates.length > 0) {
                                    $scope.configuration.mainAppId = mainAppCandidates[0].usedVersionId;
                                    mainAppCandidates[0].action = 1; // Install
                                }
                            }

                            if (!$scope.configuration.mainAppId) {
                                console.warn("AngularJS Digest Cycle issue");
                                // Issue caused by AngularJS Digest Cycle
                                // Workaround protects configuration
                                // Against unintended changes
                                // Temporary solution for stability
                                bConfigurationWasLost = true;
                            }

                            if ($scope.configuration.mainAppId) {
                                let mainApps = response.data.filter(function (app) {
                                    return app.usedVersionId === $scope.configuration.mainAppId;
                                });

                                if (mainApps.length > 0) {
                                    $scope.mainApp = mainApps[0];
                                    mainAppSelected = true;
                                }
                            }

                            if ($scope.configuration.contentAppId) {
                                let contentApps = response.data.filter(function (app) {
                                    return app.usedVersionId === $scope.configuration.contentAppId;
                                });

                                if (contentApps.length > 0) {
                                    $scope.contentApp = contentApps[0];
                                    contentAppSelected = true;
                                }
                            }
                        }, 600)
                    } else {
                        $scope.errorMessage = localization.localize(response.message);
                    }
                });
            };

            $scope.save = function (doClose) {
                $scope.errorMessage = '';
                $scope.saved = false;

                if (!$scope.configuration.pushOptions) {
                    $scope.errorMessage = localization.localize('error.empty.push.options');
                    $scope.activeConfigTab = 0;
                } else if (!$scope.configuration.name) {
                    $scope.errorMessage = localization.localize('error.empty.configuration.name');
                    $scope.activeConfigTab = 0;
                } else if (!$scope.configuration.password) {
                    $scope.errorMessage = localization.localize('error.empty.configuration.password');
                    $scope.activeConfigTab = 0;
                } else if ($scope.configuration.kioskMode && (!contentAppSelected)) {
                    $scope.errorMessage = localization.localize('error.empty.configuration.contentApp');
                    $scope.activeConfigTab = 3;
                } else if (bConfigurationWasLost) {
                    $scope.errorMessage = localization.localize('error.invalid.configuration.mainApp');
                    $scope.activeConfigTab = 3;
                } {
                    if ($scope.errorMessage) {
                        showConfigEditorToast('error', $scope.errorMessage);
                        return;
                    }
                    var request = {};

                    for (var prop in $scope.configuration) {
                        if ($scope.configuration.hasOwnProperty(prop)) {
                            request[prop] = $scope.configuration[prop];
                        }
                    }

                    if (mainAppSelected) {
                        var apps = allApplications.filter(function (app) {
                            // Intentionally using app.action == 1 but not app.action === 1
                            return (app.action == 1) && (app.usedVersionId === $scope.mainApp.usedVersionId);
                        });

                        if (apps.length === 0) {
                            $scope.errorMessage = localization.localize('error.invalid.configuration.mainApp');
                            return;
                        }

                        request["mainAppId"] = $scope.mainApp.usedVersionId;
                    } else {
                        request["mainAppId"] = null;
                    }

                    if (contentAppSelected) {
                        var apps = allApplications.filter(function (app) {
                            // Intentionally using app.action == 1 but not app.action === 1
                            return (app.action == 1) && (app.usedVersionId === $scope.contentApp.usedVersionId);
                        });

                        if (apps.length === 0) {
                            $scope.errorMessage = localization.localize('error.invalid.configuration.contentApp');
                            return;
                        }

                        request["contentAppId"] = $scope.contentApp.usedVersionId;
                    } else {
                        request["contentAppId"] = null;
                    }

                    var applications = allApplications.filter(function (app) {
                        // Intentionally using app.action != 0 but not app.action !== 0
                        return app.action != 0;
                    });

                    request.applications = applications;
                    request.type = $scope.isTypical ? 1 : 0;

                    if ($scope.configuration.systemUpdateType === 2) {
                        request.systemUpdateFrom = pad($scope.dates.systemUpdateFrom.getHours(), 2) + ':' + pad($scope.dates.systemUpdateFrom.getMinutes(), 2);
                        request.systemUpdateTo = pad($scope.dates.systemUpdateTo.getHours(), 2) + ':' + pad($scope.dates.systemUpdateTo.getMinutes(), 2);
                    }

                    request.appUpdateFrom = pad($scope.dates.appUpdateFrom.getHours(), 2) + ':' + pad($scope.dates.appUpdateFrom.getMinutes(), 2);
                    request.appUpdateTo = pad($scope.dates.appUpdateTo.getHours(), 2) + ':' + pad($scope.dates.appUpdateTo.getMinutes(), 2);

                    if ($scope.configuration.passwordMode == 'any') {
                        request.passwordMode = null;
                    }

                    if ($scope.configuration.timeZoneMode == 'default') {
                        request.timeZone = null;
                    } else if ($scope.configuration.timeZoneMode == 'auto') {
                        request.timeZone = 'auto';
                    }

                    if ($scope.configuration.allowedClasses == '') {
                        request.allowedClasses = null;
                    }

                    if ($scope.configuration.newServerUrl == '') {
                        request.newServerUrl = null;
                    }

                    if ($scope.configuration.orientation == 0) {
                        request.orientation = null;
                    }

                    $scope.saving = true;
                    configurationService.updateConfiguration(request, function (response) {
                        $scope.saving = false;
                        if (response.status === 'OK') {
                            $scope.saved = true;
                            if (doClose) {
                                $rootScope["configurationsMessage"] = localization.localize('success.configuration.saved');
                                $scope.close();
                            } else {
                                $scope.successMessage = localization.localize('success.configuration.saved');
                                showConfigEditorToast('success', $scope.successMessage);
                                $scope.configuration = response.data;

                                if ($scope.configuration.timeZone === null) {
                                    $scope.configuration.timeZoneMode = 'default';
                                } else if ($scope.configuration.timeZone === 'auto') {
                                    $scope.configuration.timeZoneMode = 'auto';
                                } else {
                                    $scope.configuration.timeZoneMode = 'manual';
                                }

                                $scope.loadApps($scope.configuration.id);
                                $scope.configurationForm.$dirty = false;
                                let $timeout1 = $timeout(function () {
                                    $scope.successMessage = null;
                                }, 5000);
                                $scope.$on('$destroy', function () {
                                    $timeout.cancel($timeout1);
                                });

                                filterApplicationSettings();
                            }
                        } else {
                            $scope.errorMessage = localization.localize(response.message);
                            showConfigEditorToast('error', $scope.errorMessage);
                        }
                    }, function () {
                        $scope.saving = false;
                        $scope.errorMessage = localization.localize('error.request.failure');
                        showConfigEditorToast('error', $scope.errorMessage);
                    });
                }
            };

            $scope.close = function () {
                $state.transitionTo('configurations');
                // $window.close();
            };

            $scope.editFile = function (configFile) {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/configurationFile.html',
                    controller: 'FileEditorController',
                    resolve: {
                        configFile: function() {
                            return configFile;
                        },
                        configFiles: function() {
                            return $scope.configuration.files;
                        },
                        defaultFilePath: function() {
                            return $scope.configuration.defaultFilePath;
                        }
                    }
                });

                modalInstance.result.then(function (file) {
                    $scope.configurationForm.$dirty = true;
                    if (configFile !== {}) {
                        // Remove old file from the configuration if it has been changed
                        $scope.configuration.files = $scope.configuration.files.filter(function (f) {
                            if (configFile.id !== null) {
                                return f.id !== configFile.id;
                            } else {
                                return f.tempId !== configFile.tempId;
                            }
                        });
                    }
                    // FileEditorController always creates new configFile link
                    file.tempId = new Date().getTime();
                    $scope.configuration.files.push(file);
                    filterFiles();
                });
            };

            var openApplicationSettingModal = function (applicationSettingSeed) {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/applicationSetting.html',
                    controller: 'ApplicationSettingEditorController',
                    resolve: {
                        applicationSetting: function () {
                            return applicationSettingSeed;
                        },
                        getApps: function () {
                            return getAppSettingsApps;
                        }
                    }
                });

                modalInstance.result.then(function (applicationSetting) {
                    if (!applicationSetting.id) {
                        applicationSetting.tempId = new Date().getTime();
                        $scope.configuration.applicationSettings.push(applicationSetting);
                        filterApplicationSettings();
                    }
                });
            };

            $scope.addApplicationSetting = function () {
                openApplicationSettingModal({type: "STRING"});
            };

            // Preselects the app whose group header the link was clicked
            // from - see ApplicationSettingEditorController's mainApp-
            // prefill guard.
            $scope.addApplicationSettingForApp = function (app) {
                openApplicationSettingModal({
                    type: "STRING",
                    applicationId: app.applicationId,
                    applicationName: app.applicationName,
                    applicationPkg: app.applicationPkg
                });
            };

            var mergeApplicationUsageParameters = function (newApplicationUsageParameters) {
                var appParametersIndex = $scope.configuration.applicationUsageParameters.findIndex(function (item) {
                    return item.applicationId === newApplicationUsageParameters.applicationId;
                });

                if (appParametersIndex < 0) {
                    $scope.configuration.applicationUsageParameters.push(newApplicationUsageParameters);
                } else {
                    $scope.configuration.applicationUsageParameters[appParametersIndex] = newApplicationUsageParameters;
                }
            };

            $scope.selectVersion = function (application) {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/configurationAppVersionSelection.html',
                    controller: 'ConfigurationAppVersionSelectController',
                    resolve: {
                        application: function () {
                            return application;
                        },
                        applicationParameters: function () {
                            return $scope.configuration.applicationUsageParameters.find(function (item) {
                                return item.applicationId === application.id;
                            });
                        },
                    }
                });

                modalInstance.result.then(function (data) {
                    var selectedAppVersion = data.selectedVersion;
                    var applicationVersions = data.availableVersions;



                    var newAppVersion = applicationVersions.filter(function (item) {
                        return item.id === selectedAppVersion.applicationVersionId;
                    })[0];

                    var currentAppVersion = applicationVersions.filter(function (item) {
                        return item.id === application.usedVersionId;
                    })[0];

                    // Compare new version and existing one
                    var comparisonResult = appVersionComparisonService.compare(newAppVersion.version, currentAppVersion.version);

                    if (comparisonResult > 0) { // Upgrade
                        let localizedText = localization.localize('form.configuration.app.version.select.upgrade.warning')
                            .replace('${v1}', application.name)
                            .replace('${v3}', newAppVersion.version)
                            .replace('${v2}', $scope.configuration.name);
                        
                        confirmModal.getUserConfirmation(localizedText, function () {
                            mergeApplicationUsageParameters(data.applicationParameters);

                            allApplications.filter(function (app) {
                                return app.id === newAppVersion.applicationId && (app.action == 1);
                            }).forEach(function (app) {
                                app.usedVersionId = newAppVersion.id;
                                app.version = newAppVersion.version;
                                app.url = newAppVersion.url;
                                app.outdated = newAppVersion.id !== app.latestVersion;
                            });

                            allApplications = allApplications.filter(function (app) {
                                return app.id !== newAppVersion.applicationId  || app.action == 1 || app.usedVersionId !== newAppVersion.id;
                            });

                            allApplications.sort(function (a, b) {
                                return appVersionComparisonService.compare(a.version, b.version)
                            });

                            $scope.applications = allApplications.filter(function (app) {
                                return (app.actionChanged || app.action != '0') && (!app.system || $scope.showSystemApps);
                            });

                            syncMainApp();
                            syncContentApp();
                        });
                    } else if (comparisonResult < 0) { // Downgrade
                        let localizedText = localization.localize('form.configuration.app.version.select.downgrade.warning')
                            .replace('${v1}', application.name)
                            .replace('${v2}', newAppVersion.version);
                        
                        confirmModal.getUserConfirmation(localizedText, function () {
                            mergeApplicationUsageParameters(data.applicationParameters);
                            applicationVersions.forEach(function (availableAppVersion) {
                                var result1 = appVersionComparisonService.compare(
                                    newAppVersion.version, availableAppVersion.version
                                );
                                if (result1 < 0) {
                                    var result2 = appVersionComparisonService.compare(
                                        availableAppVersion.version, currentAppVersion.version
                                    );
                                    if (result2 <= 0) {
                                        var alreadyListed = false;
                                        allApplications.filter(function (app) {
                                            return app.id === newAppVersion.applicationId && (app.usedVersionId === availableAppVersion.id);
                                        }).forEach(function (app) {
                                            alreadyListed = true;
                                            app.action = 2;
                                        });

                                        if (!alreadyListed) {
                                            var copy = {};
                                            for (var p in application) {
                                                if (application.hasOwnProperty(p)) {
                                                    copy[p] = application[p];
                                                }
                                            }

                                            copy.version = availableAppVersion.version;
                                            copy.usedVersionId = availableAppVersion.id;
                                            copy.action = 2;
                                            delete copy.$$hashKey;

                                            allApplications.push(copy);
                                        }
                                    }
                                }
                            });

                            var copy = {};
                            for (var p in application) {
                                if (application.hasOwnProperty(p)) {
                                    copy[p] = application[p];
                                }
                            }

                            copy.version = newAppVersion.version;
                            copy.usedVersionId = newAppVersion.id;
                            copy.action = 1;
                            delete copy.$$hashKey;

                            allApplications.push(copy);

                            allApplications = allApplications.filter(function (app) {
                                return app.id !== newAppVersion.applicationId  || app.action == 1 || app.usedVersionId !== newAppVersion.id;
                            });

                            allApplications.sort(function (a, b) {
                                return appVersionComparisonService.compare(a.version, b.version)
                            });

                            $scope.applications = allApplications.filter(function (app) {
                                return (app.actionChanged || app.action != '0') && (!app.system || $scope.showSystemApps);
                            });

                            syncMainApp();
                            syncContentApp();

                        });
                    } else {
                        mergeApplicationUsageParameters(data.applicationParameters);
                    }
                });
            };

            $scope.editDetails = function (application) {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/configurationAppDetails.html',
                    controller: 'ConfigurationAppDetailsController',
                    resolve: {
                        application: function () {
                            return application;
                        }
                    }
                });
            };

            var syncMainApp = function () {
                if ($scope.configuration.mainAppId) {
                    let mainAppInstalledVersion = $scope.applications.find(function (app) {
                        // return app.id === $scope.mainApp.id && app.action == 1;
                        return app.pkg === $scope.mainApp.pkg && app.action == 1;
                    });

                    if (mainAppInstalledVersion) {
                        var copy = {};
                        for (var p in mainAppInstalledVersion) {
                            if (mainAppInstalledVersion.hasOwnProperty(p)) {
                                copy[p] = mainAppInstalledVersion[p];
                            }
                        }
                        $scope.mainApp = copy;
                        mainAppSelected = true;
                    }
                }
            };

            var syncContentApp = function () {
                if ($scope.configuration.contentAppId) {
                    let contentAppInstalledVersion = $scope.applications.find(function (app) {
                        // return app.id === $scope.contentApp.id && app.action == 1;
                        return app.pkg === $scope.contentApp.pkg && app.action == 1;
                    });

                    if (contentAppInstalledVersion) {
                        var copy = {};
                        for (var p in contentAppInstalledVersion) {
                            if (contentAppInstalledVersion.hasOwnProperty(p)) {
                                copy[p] = contentAppInstalledVersion[p];
                            }
                        }
                        $scope.contentApp = copy;
                        contentAppSelected = true;
                    }
                }
            };

            $scope.editApplicationSetting = function (setting) {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/applicationSetting.html',
                    controller: 'ApplicationSettingEditorController',
                    resolve: {
                        applicationSetting: function () {
                            return setting;
                        },
                        getApps: function () {
                            return getAppSettingsApps;
                        }
                    }
                });

                modalInstance.result.then(function (applicationSetting) {
                    var index = $scope.configuration.applicationSettings.findIndex(function (item) {
                        if (item.id) {
                            return item.id === applicationSetting.id;
                        } else if (item.tempId) {
                            return item.tempId === applicationSetting.tempId;
                        } else {
                            return false;
                        }
                    });

                    if (index >= 0) {
                        $scope.configuration.applicationSettings[index] = applicationSetting;
                        filterApplicationSettings();
                    }
                });
            };

            $scope.removeApplicationSetting = function (applicationSetting) {
                var index = $scope.configuration.applicationSettings.findIndex(function (item) {
                    if (item.id) {
                        return item.id === applicationSetting.id;
                    } else if (item.tempId) {
                        return item.tempId === applicationSetting.tempId;
                    } else {
                        return false;
                    }
                });

                if (index >= 0) {
                    $scope.configuration.applicationSettings.splice(index, 1);
                    filterApplicationSettings();
                }
            };

            $scope.confirmRemoveApplicationSetting = function (applicationSetting) {
                var message = localization.localize('question.delete.application.setting')
                    .replace('${name}', applicationSetting.name)
                    .replace('${app}', applicationSetting.applicationName || applicationSetting.applicationPkg);
                confirmModal.getUserConfirmation(message, function () {
                    $scope.removeApplicationSetting(applicationSetting);
                });
            };

            $scope.removeFile = function (file) {
                var modalInstance = $modal.open({
                    templateUrl: 'app/components/main/view/modal/removeFileConfirmation.html',
                    controller: 'RemoveConfigurationFileModalController',
                    resolve: {
                        file: function () {
                            return file;
                        }
                    }
                });

                modalInstance.result.then(function (removeFileFromDisk) {
                    var index = $scope.configuration.files.findIndex(function (item) {
                        if (item.id) {
                            return item.id === file.id;
                        } else if (item.tempId) {
                            return item.tempId === file.tempId;
                        } else {
                            return false;
                        }
                    });

                    if (index >= 0) {
                        $scope.configurationForm.$dirty = true;
                        $scope.configuration.files.splice(index, 1);
                        filterFiles();
                    }
                });
            };

            var turnWifiOn = function () {
                $scope.configuration.wifi = true;
            };

            var turnGpsOn = function () {
                $scope.configuration.gps = true;
            };

            $scope.requestUpdatesChanged = function () {
                var networkStatus = true;
                var alertText;
                var alertCallback;
                var alertButtonText;
                if ($scope.configuration.requestUpdates === 'WIFI') {
                    networkStatus = $scope.configuration.wifi;
                    alertText = 'form.configuration.settings.request.updates.prompt.wifi';
                    alertButtonText = 'button.wifi.on';
                    alertCallback = turnWifiOn;
                } else if ($scope.configuration.requestUpdates === 'GPS') {
                    networkStatus = $scope.configuration.gps;
                    alertText = 'form.configuration.settings.request.updates.prompt.gps';
                    alertButtonText = 'button.gps.on';
                    alertCallback = turnGpsOn;
                }

                if (networkStatus === false) {
                    confirmModal.getUserConfirmation(localization.localize(alertText), alertCallback, alertButtonText);
                }
            };

            $scope.disableLocationChanged = function () {
                if ($scope.configuration.disableLocation) {
                    $scope.configuration.requestUpdates = 'DONOTTRACK';
                }
            };

            var filterApplicationSettings = function () {
                $scope.applicationSettings = $scope.configuration.applicationSettings.filter(function (item) {
                    var valid = true;
                    if ($scope.settingsPaging.appSettingsFilterText && $scope.settingsPaging.appSettingsFilterText.length > 0) {
                        var lower = $scope.settingsPaging.appSettingsFilterText.toLowerCase();

                        valid = (item.name !== null) && (item.name !== undefined) && item.name.toLowerCase().indexOf(lower) > -1
                            || (item.value !== null) && (item.value !== undefined) && item.value.toLowerCase().indexOf(lower) > -1
                            || (item.comment !== null) && ((item.comment !== undefined)) && item.comment.toLowerCase().indexOf(lower) > -1
                    }

                    if (valid) {
                        if ($scope.settingsPaging.appSettingsFilterApp && $scope.settingsPaging.appSettingsFilterApp.id) {
                            valid = item.applicationId === $scope.settingsPaging.appSettingsFilterApp.id;
                        } else if (typeof $scope.settingsPaging.appSettingsFilterApp === "string") {
                            valid = item.applicationPkg.toLowerCase().indexOf($scope.settingsPaging.appSettingsFilterApp.toLowerCase(0)) > -1;
                        }
                    }

                    return valid;
                });
            };

            // Groups the already-filtered $scope.applicationSettings by app
            // for the grouped list UI, and computes the header summary chip.
            // Cached via $watch (rather than called directly from ng-repeat/
            // interpolation) because it builds new array/object instances
            // every call - calling it inline from ng-repeat previously
            // caused an infinite-digest crash on the Applications tab for
            // the exact same reason (see appActionFilterOptions there).
            $scope.appSettingsGroups = [];
            $scope.appSettingsSummary = {settings: 0, apps: 0};
            $scope.appSettingsCollapsed = {};

            // Looked up from allApplications (already loaded for this tab's own
            // table/typeaheads) rather than fetched per-app, since this group
            // header only needs the icon fields (iconId/apkIconFileId/type)
            // that object already carries.
            var findApplicationForGroup = function (applicationId, applicationPkg) {
                var apps = allApplications || [];
                for (var i = 0; i < apps.length; i++) {
                    if (applicationId && apps[i].id === applicationId) {
                        return apps[i];
                    }
                }
                for (var j = 0; j < apps.length; j++) {
                    if (applicationPkg && apps[j].pkg === applicationPkg) {
                        return apps[j];
                    }
                }
                return null;
            };

            var computeApplicationSettingsGroups = function () {
                var byApp = {};
                var order = [];
                ($scope.applicationSettings || []).forEach(function (item) {
                    var key = item.applicationId || item.applicationPkg;
                    if (!byApp[key]) {
                        byApp[key] = {
                            applicationId: item.applicationId,
                            applicationName: item.applicationName,
                            applicationPkg: item.applicationPkg,
                            application: findApplicationForGroup(item.applicationId, item.applicationPkg),
                            settings: []
                        };
                        order.push(key);
                    }
                    byApp[key].settings.push(item);
                });
                $scope.appSettingsGroups = order.map(function (key) {
                    return byApp[key];
                });
                $scope.appSettingsSummary = {
                    settings: $scope.applicationSettings ? $scope.applicationSettings.length : 0,
                    apps: order.length
                };
            };
            $scope.$watch('applicationSettings', computeApplicationSettingsGroups, true);

            $scope.toggleAppSettingsGroup = function (key) {
                $scope.appSettingsCollapsed[key] = !$scope.appSettingsCollapsed[key];
            };

            $scope.settingTypeLabel = function (setting) {
                switch (setting.type) {
                    case 'INTEGER':
                        return localization.localize('form.application.setting.type.integer');
                    case 'BOOLEAN':
                        return localization.localize('form.application.setting.type.boolean');
                    default:
                        return localization.localize('form.application.setting.type.string');
                }
            };

            $scope.settingTypeBadgeClass = function (setting) {
                switch (setting.type) {
                    case 'INTEGER':
                        return 'users-role-blue';
                    case 'BOOLEAN':
                        return 'users-role-purple';
                    default:
                        return 'users-role-neutral';
                }
            };

            $scope.resetAppSettingsFilters = function () {
                $scope.settingsPaging.appSettingsFilterText = '';
                $scope.settingsPaging.appSettingsFilterApp = null;
                filterApplicationSettings();
            };

            var filterFiles = function () {
                $scope.files = $scope.configuration.files.filter(function (item) {
                    var valid = true;
                    if ($scope.filesPaging.filesFilterText && $scope.filesPaging.filesFilterText.length > 0) {
                        var lower = $scope.filesPaging.filesFilterText.toLowerCase();

                        valid = (item.description !== null) && (item.description !== undefined) && item.description.toLowerCase().indexOf(lower) > -1
                            || (item.path !== null) && (item.path !== undefined) && item.path.toLowerCase().indexOf(lower) > -1
                            || (item.filePath !== null) && (item.filePath !== undefined) && item.filePath.toLowerCase().indexOf(lower) > -1
                            || (item.url !== null) && ((item.url !== undefined)) && item.url.toLowerCase().indexOf(lower) > -1
                    }

                    return valid;
                });
            };

            $scope.resetFilesFilter = function () {
                $scope.filesPaging.filesFilterText = '';
                filterFiles();
            };

            // Same file-type-by-extension mapping as the main Files page
            // (files.controller.js) - duplicated here as a small pure
            // function rather than factored into a shared service, since
            // it's the only piece needed from that controller and this
            // codebase doesn't otherwise share plain helpers across
            // controllers via services.
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

            $scope.copiedFileUrlId = null;
            $scope.copyFileUrl = function (file) {
                if (!file.url || !navigator.clipboard) {
                    return;
                }
                navigator.clipboard.writeText(file.url).then(function () {
                    $timeout(function () {
                        $scope.copiedFileUrlId = file.id || file.tempId;
                    });
                    $timeout(function () {
                        if ($scope.copiedFileUrlId === (file.id || file.tempId)) {
                            $scope.copiedFileUrlId = null;
                        }
                    }, 2000);
                });
            };

            function pad(num, size) {
                var s = num + "";
                while (s.length < size) s = "0" + s;
                return s;
            }

            // Entry point
            var configId = $stateParams.id;
            setTimeout(function () {
                angular.element(document.querySelector('#password-c')).attr('type', 'password');
            }, 300);

            var togglePasswordField = function (inputId, buttonId, iconId) {
                var passwordElement = angular.element(document.querySelector(inputId));
                var passwordButton = angular.element(document.querySelector(buttonId));
                var passwordIcon = angular.element(document.querySelector(iconId));
                var type = passwordElement.attr('type');
                if (type == 'text') {
                    passwordElement.attr('type', 'password');
                    passwordButton.attr('title', localization.localize('button.show.password'));
                    passwordIcon.removeClass('glyphicon-eye-close');
                    passwordIcon.addClass('glyphicon-eye-open');
                } else {
                    passwordElement.attr('type', 'text');
                    passwordButton.attr('title', localization.localize('button.hide.password'));
                    passwordIcon.removeClass('glyphicon-eye-open');
                    passwordIcon.addClass('glyphicon-eye-close');
                }
            };

            $scope.togglePassword = function() {
                togglePasswordField('#password-c', '#button-show-password', '#span-show-password');
            };

            $scope.toggleWifiPassword = function () {
                togglePasswordField('#wifiPassword-c', '#button-show-wifi-password', '#span-show-wifi-password');
            };

            var mainAppSelected = false;
            var contentAppSelected = false;
            var allApplications;
            let bConfigurationWasLost = false;

            $scope.configuration = {
                defaultFilePath: "/Download/"
            };
            $scope.isTypical = ($stateParams.typical === 'true');
            $scope.saved = false;
            let item = $window.localStorage.getItem('HMDM_configShowSystemApps');
            if (item !== null && item !== undefined) {
                $scope.showSystemApps = (item === 'true');
            } else {
                $scope.showSystemApps = true;
            }

            var d1 = new Date();
            d1.setHours(01);
            d1.setMinutes(0);

            var d2 = new Date();
            d2.setHours(05);
            d2.setMinutes(59);

            $scope.dates = {};

            if (configId != 0) {
                configurationService.getById({"id": configId}, function (response) {
                    if (response.data) {
                        $scope.configuration = response.data;

                        filterApplicationSettings();
                        filterFiles();
                        updateMqttHint();

                        if (response.data.systemUpdateType === 2) {
                            try {
                                if (response.data.systemUpdateFrom) {
                                    var time = response.data.systemUpdateFrom;
                                    var pos = time.indexOf(':');
                                    if (pos > -1) {
                                        d1.setHours(parseInt(time.substring(0, pos)));
                                        d1.setMinutes(parseInt(time.substring(pos + 1)));
                                    }
                                }
                                if (response.data.systemUpdateTo) {
                                    var time = response.data.systemUpdateTo;
                                    var pos = time.indexOf(':');
                                    if (pos > -1) {
                                        d2.setHours(parseInt(time.substring(0, pos)));
                                        d2.setMinutes(parseInt(time.substring(pos + 1)));
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to parse system update times from server', e);
                            }
                        }

                        $scope.dates.systemUpdateFrom = d1;
                        $scope.dates.systemUpdateTo = d2;

                        try {
                            if (response.data.appUpdateFrom) {
                                var time = response.data.appUpdateFrom;
                                var pos = time.indexOf(':');
                                if (pos > -1) {
                                    d1.setHours(parseInt(time.substring(0, pos)));
                                    d1.setMinutes(parseInt(time.substring(pos + 1)));
                                }
                            }
                            if (response.data.appUpdateTo) {
                                var time = response.data.appUpdateTo;
                                var pos = time.indexOf(':');
                                if (pos > -1) {
                                    d2.setHours(parseInt(time.substring(0, pos)));
                                    d2.setMinutes(parseInt(time.substring(pos + 1)));
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse system update times from server', e);
                        }
                        $scope.dates.appUpdateFrom = d1;
                        $scope.dates.appUpdateTo = d2;

                        if ($scope.configuration.timeZone === null) {
                            $scope.configuration.timeZoneMode = 'default';
                        } else if ($scope.configuration.timeZone === 'auto') {
                            $scope.configuration.timeZoneMode = 'auto';
                        } else {
                            $scope.configuration.timeZoneMode = 'manual';
                        }
                    }
                });
            } else {
                $scope.dates.systemUpdateFrom = d1;
                $scope.dates.systemUpdateTo = d2;
                $scope.dates.appUpdateFrom = d1;
                $scope.dates.appUpdateTo = d2;
                $scope.configuration.eventReceivingComponent = 'com.hmdm.launcher.AdminReceiver';
                $scope.configuration.systemUpdateType = 0;
            }

            $scope.selected = {id: ''};

            $scope.paging = {
                currentPage: 1,
                pageSize: 50,
                filterText: ''
            };

            $scope.settingsPaging = {
                currentPage: 1,
                pageSize: 50,
                appSettingsAppFilterText: '',
                appSettingsFilterText: '',
                appSettingsFilterApp: null
            };

            $scope.filesPaging = {
                currentPage: 1,
                pageSize: 50,
                filesFilterText: '',
            };

            $scope.$watch('paging.currentPage', function () {
                $window.scrollTo(0, 0);
            });
            $scope.$watch('settingsPaging.currentPage', function () {
                $window.scrollTo(0, 0);
            });
            $scope.$watch('filesPaging.currentPage', function () {
                $window.scrollTo(0, 0);
            });

            $scope.mainApp = {id: -1, name: ""};
            $scope.contentApp = {id: -1, name: ""};

            if (!configId) {
                $scope.configuration.useDefaultDesignSettings = true;
                // settingsService.getSettings(function (response) {
                //     if (response.data) {
                //         $scope.configuration.backgroundColor = response.data.backgroundColor;
                //         $scope.configuration.textColor = response.data.textColor;
                //         $scope.configuration.backgroundImageUrl = response.data.backgroundImageUrl;
                //         $scope.configuration.iconSize = response.data.iconSize;
                //         $scope.configuration.desktopHeader = response.data.desktopHeader;
                //     }
                // });
            }

            settingsService.getSettings(function (response) {
                if (response.data) {
                    $scope.settings = response.data;
                }
            });

            if (configId > 0) {
                $scope.loadApps(configId);
            } else {
                allApplications = [];
            }
        })
    .controller('ConfigurationAppVersionSelectController', function ($scope, $modalInstance, applicationService,
                                                                     localization, application, applicationParameters) {

        $scope.errorMessage = undefined;
        $scope.application = application;
        $scope.versions = [];

        var applicationParametersCopy = {
            applicationId: application.id,
            skipVersionCheck: false
        };
        if (applicationParameters) {
            for (var p in applicationParameters) {
                if (applicationParameters.hasOwnProperty(p)) {
                    applicationParametersCopy[p] = applicationParameters[p];
                }
            }
        }

        $scope.applicationParameters = applicationParametersCopy;

        $scope.usedVersion = {
            applicationVersionId: application.usedVersionId || application.latestVersion
        };

        applicationService.getApplicationVersions({id: application.id}, function (response) {
            if (response.status === 'OK') {
                $scope.versions = response.data;
            } else {
                $scope.errorMessage = localization.localize(response.message);
            }
        }, function () {
            $scope.errorMessage = localization.localize('error.request.failure')
        });

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };

        $scope.save = function () {
            $modalInstance.close({
                selectedVersion: $scope.usedVersion,
                availableVersions: $scope.versions,
                applicationParameters: $scope.applicationParameters
            });
        };
    })
    .controller('ConfigurationAppDetailsController', function ($scope, $modalInstance, applicationService,
                                                                     localization, application) {

        $scope.errorMessage = undefined;
        $scope.application = application;

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };
    })
    .controller('FileEditorController', function ($scope, $modalInstance, localization, configFile,
                                                  defaultFilePath, fileService, configFiles) {

        $scope.file = {};
        $scope.errorMessage = undefined;
        $scope.fileSelected = false;
        $scope.isEditMode = !!configFile.fileId;

        $scope.files = [];
        fileService.getAllFiles({},
            function (response) {
                if (response.status === 'OK') {
                    // Exclude already existing files (except the file currently being edited).
                    // configFile is {} for "Add" (no fileId) and the real
                    // configuration-file link for "Edit" (has a fileId) -
                    // comparing it to a fresh {} literal with === or !==
                    // is always false/true respectively regardless of
                    // configFile's actual content (distinct object
                    // identity), which silently broke both the add flow
                    // (below) and this re-inclusion check. Pre-existing bug,
                    // fixed here as its own change alongside the redesign.
                    var configIds = new Set(configFiles.map(f => f.fileId));
                    response.data = response.data.filter(f => !configIds.has(f.id) ||
                        (!!configFile.fileId && f.id === configFile.fileId));

                    response.data.forEach(function (file) {
                        file.name = file.description ? file.description :
                            file.external ? file.url : file.filePath;
                        if (file.external) {
                            file.externalUrl = file.url;
                        }
                    });
                    $scope.files = response.data;
                    $scope.files.unshift({
                        id: 0,
                        name: localization.localize('form.configuration.file.create')
                    });
                    if (!configFile.fileId) {
                        if ($scope.files.length > 1) {
                            $scope.file = $scope.files[1];
                        } else {
                            $scope.file = $scope.files[0];
                        }
                    } else {
                        $scope.file = $scope.files.find(function(f) {
                            return f.id === configFile.fileId;
                        });
                        $scope.file.overridePath = configFile.overridePath;
                        $scope.file.devicePath = configFile.path;
                        $scope.file.remove = configFile.remove;
                    }
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            });

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

        $scope.fileSelected = function(id) {

        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };

        $scope.save = function () {
            $scope.errorMessage = undefined;
            valid = true;

            if ($scope.file.id === 0) {
                // Check new file validity
                if ($scope.file.external) {
                    if ($scope.file.externalUrl.trim().length === 0) {
                        $scope.errorMessage = localization.localize('error.configuration.file.empty.url');
                        valid = false;
                    }
                } else {
                    if (!$scope.file.tmpPath) {
                        $scope.errorMessage = localization.localize('error.configuration.file.empty.file');
                        valid = false;
                    }
                }
                var request = {};
                for (var prop in $scope.file) {
                    if ($scope.file.hasOwnProperty(prop)) {
                        request[prop] = $scope.file[prop];
                    }
                }
                // Backend accepts null (not 0) for new file creation
                request.id = null;

                fileService.updateFile(request, function (response) {
                    if (response.status === 'OK') {
                        // $scope.file is UploadedFile, make a "new" ConfigurationFile from it
                        $scope.file.fileId = response.data.id;
                        $scope.file.filePath = response.data.filePath;
                        $scope.file.url = response.data.url;
                        $scope.file.path = response.data.devicePath;
                        $scope.file.tmpPath = response.data.tmpPath;
                        $scope.file.id = null;
                        $modalInstance.close($scope.file);
                    } else {
                        $scope.errorMessage = localization.localize(response.message);
                    }
                });

            } else {
                // $scope.file is UploadedFile, make a "new" ConfigurationFile from it
                $scope.file.fileId = $scope.file.id;
                $scope.file.id = null;
                $scope.file.path = $scope.file.devicePath;
                $modalInstance.close($scope.file);
            }
        };

        $scope.onStartedUpload = function (files) {
            $scope.successMessage = undefined;
            $scope.errorMessage = undefined;
            $scope.loading = true;
        };

        $scope.onUploadProgress = function(progress) {
            var loadedMb = (progress.loaded / 1048576).toFixed(1);
            var totalMb = (progress.total / 1048576).toFixed(1);
            $scope.successMessage = localization.localize('success.uploading.file') +
                " " + loadedMb + " / " + totalMb + " Mb";
        };

        $scope.fileUploaded = function (response) {
            $scope.errorMessage = undefined;
            $scope.successMessage = undefined;

            $scope.loading = false;

            if (response.data.status === 'OK') {
                $scope.file.filePath = response.data.data.name;
                $scope.file.tmpPath = response.data.data.serverPath;
                if (!defaultFilePath.endsWith("/")) {
                    defaultFilePath += "/";
                }
                $scope.file.devicePath = defaultFilePath + response.data.data.name;
                $scope.successMessage = localization.localize('success.file.uploaded');
            } else if (response.data.message == 'error.size.limit.exceeded') {
                $scope.errorMessage = localization.localize(response.data.message) + ' (' + response.data.data + ' Mb)';
            } else {
                $scope.errorMessage = localization.localize(response.data.message);
            }
        };
    })
    .controller('RemoveConfigurationFileModalController',
        function ($scope, $modalInstance, file) {

            $scope.file = file;

            // By now, disable this option so the user isn't confused
            // TODO: suggest permanent deletion if a file is not used in icons and configurations (except this one)
            $scope.deleteOptionEnabled = false;

            $scope.save = function () {
                $modalInstance.close($scope.deleteOptionEnabled && $scope.obj.deleteFileFromDisk);
            };

            $scope.closeModal = function () {
                $modalInstance.dismiss();
            }
        })
;