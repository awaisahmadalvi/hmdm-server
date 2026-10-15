// Localization completed
angular.module('headwind-kiosk')
    .controller('UpdatesController', function ($scope, $modal, updatesService, localization, utils, APP_VERSION) {
        $scope.errorMessage = '';
        $scope.completeMessage = localization.localize('updates.checking');
        $scope.isChecking = true;
        $scope.isUpdating = false;
        $scope.isError = false;
        $scope.updateForm = {
            update: false,
            sendStats: true
        };

        var checkUpdates = function() {
            updatesService.checkUpdates(function (response) {
                $scope.isChecking = false;
                $scope.completeMessage = '';

                if (response.status === 'OK') {
                    response.data.forEach(function(app) {
                        if (app.pkg === 'web') {
                            app.currentVersion = APP_VERSION;
                        }
                        app.outdated = utils.compareVersions(app.currentVersion, app.version) < 0;
                        if (app.updateDisabled) {
                            app.updateDisableReasonLocalized = localization.localize('updates.disabled.' + app.updateDisableReason);
                        }
                    });

                    $scope.updates = response.data;
                } else if (response.status === 'ERROR') {
                        $scope.isError = true;
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            });
        };

        $scope.getUpdates = function() {
            $scope.completeMessage = localization.localize('updates.getting');
            $scope.isUpdating = true;
            $scope.updateForm.updates = $scope.updates;

            updatesService.getUpdates($scope.updateForm, function (response) {
                $scope.isUpdating = false;
                $scope.completeMessage = localization.localize('updates.success');

                if (response.status === 'OK') {
                    response.data.forEach(function(app) {
                        app.outdated = utils.compareVersions(app.currentVersion, app.version) < 0;
                        if (app.updateDisabled) {
                            app.updateDisableReasonLocalized = localization.localize('updates.disabled.' + app.updateDisableReason);
                        }
                    });

                    $scope.updates = response.data;

                } else if (response.status === 'ERROR') {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            });
        };

        // Presentational-only: component names/icons for the versions table
        // (the server's app.name is the Applications entry name)
        $scope.componentName = function(app) {
            if (app.pkg === 'web') {
                return localization.localize('updates.component.web');
            }
            if (app.pkg === 'com.hmdm.launcher') {
                return localization.localize('updates.component.agent').replace('${name}', app.name);
            }
            return app.name;
        };

        $scope.componentIcon = function(app) {
            return app.pkg === 'web' ? 'monitor' : 'smartphone';
        };

        // "Get updates" asks first, then runs getUpdates() above unchanged.
        // The list mirrors the server's rule (UpdateResource): outdated,
        // not disabled and not yet downloaded.
        $scope.confirmGetUpdates = function() {
            var downloads = [];
            var hasAgentDownload = false;
            ($scope.updates || []).forEach(function(app) {
                if (app.outdated && !app.updateDisabled && !app.downloaded) {
                    var effect;
                    if (app.pkg === 'web') {
                        effect = localization.localize('updates.confirm.effect.web');
                    } else {
                        effect = localization.localize($scope.updateForm.update ?
                            'updates.confirm.effect.app.auto' : 'updates.confirm.effect.app');
                        if (app.pkg === 'com.hmdm.launcher') {
                            hasAgentDownload = true;
                        }
                    }
                    downloads.push({name: $scope.componentName(app), from: app.currentVersion, to: app.version, effect: effect});
                }
            });

            $modal.open({
                templateUrl: 'app/components/main/view/modal/updatesConfirm.html',
                controller: 'UpdatesConfirmController',
                windowClass: 'app-modal-narrow app-modal-updates-confirm app-modal-fullscreen-mobile',
                resolve: {
                    summary: function() {
                        return {downloads: downloads, hasAgentDownload: hasAgentDownload, form: $scope.updateForm};
                    }
                }
            }).result.then(function() {
                $scope.getUpdates();
            }, angular.noop); // Cancel/Esc/backdrop: nothing happens
        };

        checkUpdates();
    })
    .controller('UpdatesConfirmController', function ($scope, $modalInstance, summary) {
        $scope.downloads = summary.downloads;
        $scope.hasAgentDownload = summary.hasAgentDownload;
        $scope.form = summary.form;

        $scope.OK = function() {
            $modalInstance.close();
        };
        $scope.cancel = function() {
            $modalInstance.dismiss();
        };
    });



