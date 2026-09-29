/*
 *
 * Headwind MDM: Open Source Android MDM Software
 * https://h-mdm.com
 *
 * Copyright (C) 2019 Headwind Solutions LLC (http://h-sms.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Localization completed
angular.module('headwind-kiosk')
    .controller('PluginsTabController', function ($scope, $rootScope, $timeout, $state,
                                                   localization, pluginService) {
        $scope.loading = false;
        $scope.savingPlugins = false;
        $scope.pluginsToast = null;

        $scope.errorMessage = undefined;
        $scope.successMessage = undefined;

        var clearMessages = function () {
            $scope.errorMessage = undefined;
            $scope.successMessage = undefined;
        };

        var showPluginsToast = function (type, message) {
            $scope.pluginsToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.pluginsToast && $scope.pluginsToast.message === message) {
                    $scope.pluginsToast = null;
                }
            }, 3000);
        };

        // Small config mapping a plugin's stable string identifier to a
        // representative icon and one-line description. The Functions menu
        // itself shows no icons to copy (checked content.html), so these
        // were chosen to match what each plugin's own page actually does.
        // "xtra" (shows up here as "More plugins...") is a real, permission-
        // gated plugin with its own Functions-menu entry and ui-router
        // state (plugin-xtra) - mechanically identical to the others, so it
        // keeps its toggle - but its actual page is a Premium-upsell/
        // browse-more-plugins page, not a device-management feature, so
        // it's called out visually instead of given an invented feature
        // description; its real API-provided description is used instead.
        // Unknown future plugins fall back the same way.
        var PLUGIN_META = {
            audit: {icon: 'glyphicon-list-alt', descriptionKey: 'form.settings.plugins.desc.audit'},
            deviceinfo: {icon: 'glyphicon-info-sign', descriptionKey: 'form.settings.plugins.desc.deviceinfo'},
            devicelog: {icon: 'glyphicon-list', descriptionKey: 'form.settings.plugins.desc.devicelog'},
            messaging: {icon: 'glyphicon-comment', descriptionKey: 'form.settings.plugins.desc.messaging'},
            push: {icon: 'glyphicon-send', descriptionKey: 'form.settings.plugins.desc.push'},
            xtra: {icon: 'glyphicon-star', browseMore: true}
        };

        $scope.pluginIcon = function (plugin) {
            var meta = PLUGIN_META[plugin.identifier];
            return (meta && meta.icon) || 'glyphicon-cog';
        };

        $scope.pluginDescription = function (plugin) {
            var meta = PLUGIN_META[plugin.identifier];
            if (meta && meta.descriptionKey) {
                return localization.localize(meta.descriptionKey);
            }
            return plugin.description || '';
        };

        $scope.isBrowseMorePlugin = function (plugin) {
            var meta = PLUGIN_META[plugin.identifier];
            return !!(meta && meta.browseMore);
        };

        $scope.enabledPluginCount = function () {
            var count = 0;
            angular.forEach($scope.pluginSelection, function (value) {
                if (value) {
                    count++;
                }
            });
            return count;
        };

        $scope.openPlugin = function (plugin) {
            if (plugin.functionsViewTemplate) {
                $state.go('plugin-' + plugin.identifier);
            }
        };

        var pluginSelectionSnapshot = null;

        $scope.isPluginsDirty = function () {
            return !!pluginSelectionSnapshot && !angular.equals($scope.pluginSelection, pluginSelectionSnapshot);
        };

        $scope.resetPluginSelection = function () {
            if (pluginSelectionSnapshot) {
                $scope.pluginSelection = angular.copy(pluginSelectionSnapshot);
            }
            clearMessages();
        };

        var loadData = function () {
            clearMessages();

            $scope.loading = true;
            pluginService.getActivePlugins(function (response) {
                if (response.status === 'OK') {
                    var plugins = response.data;
                    var pluginSelection = {};

                    plugins.forEach(function (plugin) {
                        plugin.localizedName = localization.localize(plugin.nameLocalizationKey);
                        pluginSelection[plugin.id] = false;
                    });

                    plugins.sort(function (a, b) {
                        var t1 = a.localizedName;
                        var t2 = b.localizedName;

                        if (t1 === t2) {
                            return 0;
                        } else if (t1 < t2) {
                            return -1;
                        } else {
                            return 1;
                        }
                    });

                    pluginService.getAvailablePlugins(function (response) {
                        $scope.loading = false;

                        if (response.status === 'OK') {
                            response.data.forEach(function (plugin) {
                                pluginSelection[plugin.id] = true;
                            });

                            $scope.plugins = plugins;
                            $scope.pluginSelection = pluginSelection;
                            pluginSelectionSnapshot = angular.copy(pluginSelection);

                        } else {
                            $scope.errorMessage = localization.localizeServerResponse(response);
                        }
                    }, function () {
                        $scope.loading = false;
                        $scope.errorMessage = localization.localize("error.request.failure");
                    });
                } else {
                    $scope.loading = false;
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.loading = false;
                $scope.errorMessage = localization.localize("error.request.failure");
            });
        };

        $scope.save = function () {
            clearMessages();

            var request = [];
            for (var p in $scope.pluginSelection) {
                if ($scope.pluginSelection.hasOwnProperty(p)) {
                    if ($scope.pluginSelection[p] === false) {
                        request.push(p);
                    }
                }
            }

            $scope.loading = true;
            $scope.savingPlugins = true;
            pluginService.disablePlugins(request, function (response) {
                $scope.loading = false;
                $scope.savingPlugins = false;
                if (response.status === 'OK') {
                    $scope.successMessage = localization.localize('success.plugins.disabled');
                    // Refreshes $scope.functionsPlugins/settingsPlugins in
                    // TabController (see its 'aero_PLUGINS_UPDATED' listener)
                    // so the Functions menu updates without a page reload.
                    $rootScope.$broadcast('aero_PLUGINS_UPDATED');
                    pluginSelectionSnapshot = angular.copy($scope.pluginSelection);
                    showPluginsToast('success', $scope.successMessage);
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                    showPluginsToast('error', $scope.errorMessage);
                }
            }, function () {
                $scope.loading = false;
                $scope.savingPlugins = false;
                $scope.errorMessage = localization.localize("error.request.failure");
                showPluginsToast('error', $scope.errorMessage);
            });
        };

        loadData();
    });
