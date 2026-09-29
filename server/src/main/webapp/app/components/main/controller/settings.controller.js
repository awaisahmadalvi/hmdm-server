// Localization completed
angular.module('headwind-kiosk')
    .controller('SettingsTabController', function ($scope, $rootScope, $timeout, $modal, hintService, settingsService,
                                                   localization, authService, userService, confirmModal, Idle,
                                                   groupService, configurationService, twoFactorAuthService,
                                                   $transitions, $q, $state) {
        $scope.settings = {};
        $scope.userRoleSettings = {};
        $scope.loading = false;

        var userRoleSettings = {};

        $scope.formData = {
            userRoleId: authService.getUser().userRole.id
        };

        // Devices-table column config: which userRoleSettings.columnDisplayed*
        // flag belongs to which card group on the redesigned "Visible
        // columns" page, and in what order they appear in the real Devices
        // table (used for the live preview). One config object driving a
        // single ng-repeat'd row template, instead of one hardcoded row of
        // markup per column.
        var COLUMN_DEFS = [
            {key: 'columnDisplayedDeviceStatus', labelKey: 'form.settings.common.status', group: 'status'},
            {key: 'columnDisplayedDeviceDate', labelKey: 'form.settings.common.date', group: 'status'},
            {key: 'columnDisplayedDeviceNumber', labelKey: 'form.settings.common.device.number', group: 'identity'},
            {key: 'columnDisplayedDeviceImei', labelKey: 'form.settings.common.imei', group: 'hardware'},
            {key: 'columnDisplayedDevicePhone', labelKey: 'form.settings.common.phone.number', group: 'hardware'},
            {key: 'columnDisplayedDeviceModel', labelKey: 'form.settings.common.phone.model', group: 'hardware'},
            {key: 'columnDisplayedDevicePermissionsStatus', labelKey: 'form.settings.common.status.permissions', group: 'compliance'},
            {key: 'columnDisplayedDeviceAppInstallStatus', labelKey: 'form.settings.common.status.installation', group: 'compliance'},
            {key: 'columnDisplayedDeviceFilesStatus', labelKey: 'form.settings.common.status.files', group: 'compliance'},
            {key: 'columnDisplayedDeviceConfiguration', labelKey: 'form.settings.common.config', group: 'identity'},
            {key: 'columnDisplayedDeviceDesc', labelKey: 'form.settings.common.desc', group: 'identity'},
            {key: 'columnDisplayedDeviceGroup', labelKey: 'form.settings.common.group', group: 'identity'},
            {key: 'columnDisplayedLauncherVersion', labelKey: 'form.settings.common.launcher.version', group: 'launcher'},
            {key: 'columnDisplayedBatteryLevel', labelKey: 'form.settings.common.battery.level', group: 'hardware'},
            {key: 'columnDisplayedMdmMode', labelKey: 'form.settings.common.mdm.mode', group: 'launcher'},
            {key: 'columnDisplayedKioskMode', labelKey: 'form.settings.common.kiosk.mode', group: 'launcher'},
            {key: 'columnDisplayedDefaultLauncher', labelKey: 'form.settings.common.default.launcher', group: 'launcher'},
            {key: 'columnDisplayedAndroidVersion', labelKey: 'form.settings.common.android.version', group: 'hardware'},
            {key: 'columnDisplayedEnrollmentDate', labelKey: 'form.settings.common.enrollment.date', group: 'status'},
            {key: 'columnDisplayedSerial', labelKey: 'form.settings.common.serial', group: 'hardware'},
            {key: 'columnDisplayedPublicIp', labelKey: 'form.settings.common.publicip', group: 'status'},
            {key: 'columnDisplayedCustom1', customProp: 'customPropertyName1', group: 'identity'},
            {key: 'columnDisplayedCustom2', customProp: 'customPropertyName2', group: 'identity'},
            {key: 'columnDisplayedCustom3', customProp: 'customPropertyName3', group: 'identity'}
        ];

        $scope.columnGroups = [
            {id: 'status', titleKey: 'form.settings.common.group.status'},
            {id: 'identity', titleKey: 'form.settings.common.group.identity'},
            {id: 'hardware', titleKey: 'form.settings.common.group.hardware'},
            {id: 'compliance', titleKey: 'form.settings.common.group.compliance'},
            {id: 'launcher', titleKey: 'form.settings.common.group.launcher'}
        ];

        var columnDefApplies = function (def) {
            return !def.customProp || !!($scope.settings && $scope.settings[def.customProp]);
        };

        $scope.columnLabel = function (def) {
            return def.customProp ? $scope.settings[def.customProp] : localization.localize(def.labelKey);
        };

        $scope.groupColumns = function (groupId) {
            return COLUMN_DEFS.filter(function (def) {
                return def.group === groupId && columnDefApplies(def);
            });
        };

        $scope.orderedColumnDefs = function () {
            return COLUMN_DEFS.filter(columnDefApplies);
        };

        $scope.enabledColumnDefs = function () {
            return $scope.orderedColumnDefs().filter(function (def) {
                return $scope.userRoleSettings && $scope.userRoleSettings[def.key];
            });
        };

        $scope.totalColumnCount = function () {
            return $scope.orderedColumnDefs().length;
        };

        $scope.enabledColumnCount = function () {
            return $scope.enabledColumnDefs().length;
        };

        $scope.groupEnabledCount = function (groupId) {
            return $scope.groupColumns(groupId).filter(function (def) {
                return $scope.userRoleSettings && $scope.userRoleSettings[def.key];
            }).length;
        };

        $scope.setGroupAll = function (groupId, value) {
            $scope.groupColumns(groupId).forEach(function (def) {
                $scope.userRoleSettings[def.key] = value;
            });
        };

        var columnsSnapshot = null;

        $scope.isColumnsDirty = function () {
            return !!columnsSnapshot && !angular.equals($scope.userRoleSettings, columnsSnapshot);
        };

        $scope.resetColumnsSettings = function () {
            if (!columnsSnapshot) {
                return;
            }
            angular.forEach(columnsSnapshot, function (value, key) {
                $scope.userRoleSettings[key] = value;
            });
        };

        $scope.currentRoleName = function () {
            var role = null;
            angular.forEach($scope.userRoles, function (r) {
                if (r.id === $scope.formData.userRoleId) {
                    role = r;
                }
            });
            return role ? role.name : '';
        };

        $scope.roleDropdownProxy = $scope.formData.userRoleId;

        $scope.requestRoleChange = function (roleId) {
            if (roleId === $scope.formData.userRoleId) {
                $scope.roleDropdownProxy = $scope.formData.userRoleId;
                return;
            }
            var applyChange = function () {
                $scope.formData.userRoleId = roleId;
                $scope.roleDropdownProxy = roleId;
                $scope.userRoleChanged();
            };
            if ($scope.isColumnsDirty()) {
                confirmModal.getUserConfirmation(localization.localize('form.settings.common.unsaved.role.confirm'), applyChange);
                // On cancel, revert the dropdown fallback's proxy value back
                // to the still-active role (the pill buttons never mutated
                // formData.userRoleId to begin with, so nothing to revert there).
                $scope.roleDropdownProxy = $scope.formData.userRoleId;
            } else {
                applyChange();
            }
        };

        $scope.savingColumns = false;
        $scope.columnsToast = null;

        var showColumnsToast = function (type, message) {
            $scope.columnsToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.columnsToast && $scope.columnsToast.message === message) {
                    $scope.columnsToast = null;
                }
            }, 3000);
        };

        var onRequestFailure = function () {
            $scope.loading = false;
            $scope.errorMessage = localization.localize('error.request.failure');
        };

        var clearMessages = function () {
            $scope.successMessage = undefined;
            $scope.errorMessage = undefined;
        };

        $scope.init = function () {
            $rootScope.settingsTabActive = true;
            $rootScope.pluginsTabActive = false;

            clearMessages();

            $scope.loading = true;

            groupService.getAllGroups(function (response) {
                $scope.groups = response.data;

                configurationService.getAllConfigurations(function (response) {
                    $scope.configurations = response.data;

                    settingsService.getSettings(function (response) {
                        if (response.data) {
                            $scope.settings = response.data;
                            $scope.initTwoFactor($scope.settings);
                            designSettingsSnapshot = angular.copy($scope.settings);
                        }
                        $scope.loading = false;
                    }, onRequestFailure);
                }, onRequestFailure);
            }, onRequestFailure);

        };

        var user = authService.getUser();
        $scope.twoFactor = {
            success: null,
            error: null,
            accepted: user.twoFactorAccepted,
            qrCodeUrl: 'rest/private/twofactor/qr/' + user.id,
            code: ''
        };

        $scope.initTwoFactor = function(settings) {
            $scope.twoFactor.use = settings.twoFactor;
        };

        $scope.twoFactorToggled = function() {
            if (!$scope.twoFactor.use) {
                $scope.twoFactor.use = true;
                confirmModal.getUserConfirmation(localization.localize('form.two.factor.auth.off.confirm'), function () {
                    twoFactorAuthService.reset(function(response) {
                        if (response.status === 'OK') {
                            var user = authService.getUser();
                            user.twoFactorSecret = null;
                            user.twoFactorAccepted = false;
                            authService.update(user);
                            $scope.settings.twoFactor = false;
                            $scope.twoFactor.accepted = false;
                            $scope.twoFactor.code = '';
                            $scope.twoFactor.error = '';
                            $scope.twoFactor.success = localization.localize('form.two.factor.auth.reset');
                            $scope.twoFactor.use = false;
                            $timeout(function () {
                                $scope.twoFactor.success = null;
                            }, 5000);
                        } else {
                            $scope.twoFactor.error = localization.localizeServerResponse(response);
                        }
                    });
                });
            } else {
                // Force QR code to reload and re-generate the secret
                $scope.twoFactor.qrCodeUrl = 'rest/private/twofactor/qr/' + authService.getUser().id +
                    '?' + new Date().getTime();
            }
        };

        $scope.verifyTwoFactor = function() {
            if ($scope.twoFactor.code.length != 6 || !/^\d+$/.test($scope.twoFactor.code)) {
                $scope.twoFactor.error = localization.localize('form.two.factor.auth.code.error');
                return;
            }

            var data = {
                user: authService.getUser().id,
                code: $scope.twoFactor.code
            };
            twoFactorAuthService.verify(data, function (response) {
                if (response.status === 'OK') {
                    var user = authService.getUser();
                    user.twoFactorAccepted = true;
                    authService.update(user);
                    twoFactorAuthService.set(function(response) {
                        if (response.status === 'OK') {
                            $scope.settings.twoFactor = true;
                            $scope.twoFactor.accepted = true;
                            $scope.twoFactor.code = '';
                            $scope.twoFactor.error = '';
                            $scope.twoFactor.success = localization.localize('form.two.factor.auth.set');
                            $timeout(function () {
                                $scope.twoFactor.success = null;
                            }, 5000);
                        } else {
                            $scope.twoFactor.error = localization.localizeServerResponse(response);
                        }
                    });
                } else if (response.status === 'ERROR') {
                    if (response.message === 'error.permission.denied') {
                        $scope.twoFactor.error = localization.localize('form.two.factor.auth.code.invalid');
                    } else {
                        $scope.twoFactor.error = localization.localizeServerResponse(response);
                    }
                }
            });
        };

        $scope.desktopHeaderTemplatePlaceholder = localization.localize('form.configuration.settings.design.desktop.header.template.placeholder') + ' deviceId, description, custom1, custom2, custom3';

        $scope.initCommonSettings = function () {
            clearMessages();

            var roleId = authService.getUser().userRole.id;
            $scope.loading = true;
            settingsService.getUserRoleSettings({roleId: roleId}, function (response) {
                if (response.status === 'OK') {
                    $scope.userRoleSettings = response.data;
                    userRoleSettings[roleId] = response.data;
                    columnsSnapshot = angular.copy($scope.userRoleSettings);

                    userService.getUserRoles(function (response) {
                        if (response.status === 'OK') {
                            $scope.userRoles = response.data;
                        } else {
                            $scope.errorMessage = localization.localizeServerResponse(response);
                        }
                        $scope.loading = false;
                    }, onRequestFailure);
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, onRequestFailure);
        };

        $scope.userRoleChanged = function () {
            clearMessages();

            var roleId = $scope.formData.userRoleId;
            if (!userRoleSettings[roleId]) {
                $scope.loading = true;
                settingsService.getUserRoleSettings({roleId: roleId}, function (response) {
                    if (response.status === 'OK') {
                        $scope.userRoleSettings = response.data;
                        userRoleSettings[roleId] = response.data;
                        columnsSnapshot = angular.copy($scope.userRoleSettings);
                    } else {
                        $scope.errorMessage = localization.localizeServerResponse(response);
                    }
                    $scope.loading = false;
                }, onRequestFailure);
            } else {
                $scope.userRoleSettings = userRoleSettings[roleId];
                columnsSnapshot = angular.copy($scope.userRoleSettings);
            }
        };

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
                    $scope.settings.backgroundImageUrl = data.url;
                }
            });
        };

        $scope.removeBackgroundImage = function () {
            $scope.settings.backgroundImageUrl = '';
        };

        $scope.backgroundImageFileName = function () {
            var url = $scope.settings && $scope.settings.backgroundImageUrl;
            if (!url) {
                return '';
            }
            var parts = url.split('/');
            return parts[parts.length - 1] || url;
        };

        var HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

        $scope.isValidHex = function (value) {
            return !value || HEX_COLOR_RE.test(value);
        };

        $scope.designColorPresets = [
            {label: localization.localize('form.settings.design.color.preset.navy'), value: '#0f172a'},
            {label: localization.localize('form.settings.design.color.preset.white'), value: '#ffffff'},
            {label: localization.localize('form.settings.design.color.preset.black'), value: '#000000'}
        ];

        $scope.applyColorPreset = function (field, value) {
            $scope.settings[field] = value;
        };

        // The native <input type="color"> swatch only ever accepts a full
        // 6-digit hex value, but settings.backgroundColor/textColor (the
        // real, saved model) may be a 3-digit hex, empty, or momentarily
        // invalid while the user is typing in the text field. Rather than
        // binding the swatch straight to that field (which would let the
        // browser silently coerce/overwrite it to #000000), mirror it
        // through this normalized proxy so the swatch always shows a valid
        // color and only writes back to the real field when the user
        // actually picks a new one.
        var expandHex = function (value) {
            if (!HEX_COLOR_RE.test(value || '')) {
                return null;
            }
            if (value.length === 4) {
                return '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
            }
            return value.toLowerCase();
        };

        $scope.colorSwatchProxy = {};

        var syncSwatchProxy = function (field, fallback) {
            $scope.colorSwatchProxy[field] = expandHex($scope.settings[field]) || fallback;
        };

        $scope.$watch('settings.backgroundColor', function () {
            syncSwatchProxy('backgroundColor', '#0f172a');
        });
        $scope.$watch('settings.textColor', function () {
            syncSwatchProxy('textColor', '#ffffff');
        });

        $scope.applySwatchColor = function (field) {
            $scope.settings[field] = $scope.colorSwatchProxy[field];
        };

        // Fallback used only to keep the live preview rendering something
        // sane while the user is mid-typing an invalid hex value; the
        // actual saved value is never touched here.
        $scope.previewColor = function (value, fallback) {
            return $scope.isValidHex(value) && value ? value : fallback;
        };

        $scope.iconSizePreviewClass = function () {
            var size = $scope.settings && $scope.settings.iconSize;
            if (size === 'LARGE') {
                return 'design-preview-icon-large';
            }
            if (size === 'MEDIUM') {
                return 'design-preview-icon-medium';
            }
            return 'design-preview-icon-small';
        };

        $scope.previewHeaderText = function () {
            var header = $scope.settings && $scope.settings.desktopHeader;
            switch (header) {
                case 'DEVICE_ID':
                    return localization.localize('form.settings.design.preview.header.deviceid');
                case 'DESCRIPTION':
                    return localization.localize('form.settings.design.preview.header.description');
                case 'TEMPLATE':
                    return $scope.settings.desktopHeaderTemplate || localization.localize('form.settings.design.preview.header.custom');
                case 'CUSTOM1':
                case 'CUSTOM2':
                case 'CUSTOM3':
                    return localization.localize('form.settings.design.preview.header.custom');
                default:
                    return '';
            }
        };

        $scope.previewAppNames = [1, 2, 3, 4, 5, 6];

        var designSettingsSnapshot = null;

        $scope.isDesignDirty = function () {
            return !!designSettingsSnapshot && !angular.equals($scope.settings, designSettingsSnapshot);
        };

        $scope.resetDesignSettings = function () {
            if (designSettingsSnapshot) {
                $scope.settings = angular.copy(designSettingsSnapshot);
            }
            clearMessages();
        };

        $scope.savingDesign = false;
        $scope.designToast = null;

        var showDesignToast = function (type, message) {
            $scope.designToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.designToast && $scope.designToast.message === message) {
                    $scope.designToast = null;
                }
            }, 3000);
        };

        $scope.saveDefaultDesignSettings = function () {
            clearMessages();
            $scope.savingDesign = true;
            settingsService.updateDefaultDesignSettings($scope.settings, function (response) {
                $scope.savingDesign = false;
                if (response.status === 'OK') {
                    $scope.successMessage = localization.localize('success.settings.design.saved');
                    $timeout(function () {
                        $scope.successMessage = '';
                    }, 2000);
                    designSettingsSnapshot = angular.copy($scope.settings);
                    showDesignToast('success', localization.localize('success.settings.design.saved'));
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                    showDesignToast('error', $scope.errorMessage);
                }
            }, function () {
                $scope.savingDesign = false;
                $scope.errorMessage = localization.localize('error.request.failure');
                showDesignToast('error', $scope.errorMessage);
            });
        };

        // This controller is shared by every Settings tab (Common/Language/
        // Hints/Design), each its own instance/scope - only guard
        // navigation when this instance is actually the Design tab, so the
        // design-specific confirmation text can't show up while leaving a
        // different settings tab.
        // Also: this app's ui-router is v1.x, which no longer broadcasts
        // the legacy $stateChangeStart event (that's an optional add-on
        // this app doesn't load) - the supported hook point is $transitions.
        if ($state.current.name === 'designSettings') {
            var deregisterTransitionHook = $transitions.onStart({}, function () {
                if (!$scope.isDesignDirty()) {
                    return true;
                }
                var deferred = $q.defer();
                confirmModal.getUserConfirmation(localization.localize('form.settings.design.unsaved.confirm'), function () {
                    deferred.resolve(true);
                });
                return deferred.promise;
            });
            $scope.$on('$destroy', deregisterTransitionHook);
        }

        if ($state.current.name === 'commonSettings') {
            var deregisterColumnsTransitionHook = $transitions.onStart({}, function () {
                if (!$scope.isColumnsDirty()) {
                    return true;
                }
                var deferred = $q.defer();
                confirmModal.getUserConfirmation(localization.localize('form.settings.common.unsaved.confirm'), function () {
                    deferred.resolve(true);
                });
                return deferred.promise;
            });
            $scope.$on('$destroy', deregisterColumnsTransitionHook);
        }

        $scope.saveCommonSettings = function () {
            clearMessages();
            $scope.savingColumns = true;
            var settings = [];
            for (var p in userRoleSettings) {
                if (userRoleSettings.hasOwnProperty(p)) {
                    settings.push(userRoleSettings[p]);
                }
            }

            settingsService.updateUserRolesCommonSettings(settings, function (response) {
                $scope.savingColumns = false;
                if (response.status === 'OK') {
                    $scope.successMessage = localization.localize('success.settings.common.saved');
                    $timeout(function () {
                        $scope.successMessage = '';
                    }, 2000);
                    $rootScope.$broadcast('aero_COMMON_SETTINGS_UPDATED', settings);
                    columnsSnapshot = angular.copy($scope.userRoleSettings);
                    showColumnsToast('success', localization.localize('form.settings.common.toast.saved.prefix') + ' ' + $scope.currentRoleName());
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                    showColumnsToast('error', $scope.errorMessage);
                }
            }, function () {
                $scope.savingColumns = false;
                $scope.errorMessage = localization.localize('error.request.failure');
                showColumnsToast('error', $scope.errorMessage);
            });
        };

        $scope.saveLanguageSettings = function () {
            clearMessages();

            if ($scope.settings.createNewDevices && !$scope.settings.newDeviceConfigurationId) {
                $scope.errorMessage = localization.localize('error.empty.configuration');
                return;
            }

            if ($scope.settings.idleLogout) {
                Idle.setIdle($scope.settings.idleLogout);
                Idle.setTimeout(10);
                Idle.watch();
            } else {
                $scope.settings.idleLogout = null;  // Change 0 to null
                Idle.unwatch();
            }

            settingsService.updateMiscSettings($scope.settings, function (response) {
                if (response.status === 'OK') {
                    settingsService.updateLanguageSettings($scope.settings, function (response) {
                        if (response.status === 'OK') {
                            $rootScope.$broadcast('aero_LANGUAGE_SETTINGS_UPDATED', $scope.settings);
                            $scope.successMessage = localization.localize('success.settings.saved');
                            $timeout(function () {
                                $scope.successMessage = '';
                            }, 2000);
                        }
                    });
                }
            });
        };

        $scope.enableHints = function () {
            clearMessages();
            hintService.enableHints(function (response) {
                if (response.status === 'OK') {
                    $scope.successMessage = localization.localize('success.settings.hints.enabled');
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.errorMessage = localization.localize('error.request.failure');
            });
        };

        $scope.disableHints = function () {
            clearMessages();
            hintService.disableHints(function (response) {
                if (response.status === 'OK') {
                    $scope.successMessage = localization.localize('success.settings.hints.disabled');
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.errorMessage = localization.localize('error.request.failure');
            });
        };

        $scope.init();

    });