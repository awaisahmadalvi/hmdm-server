// Localization completed
angular.module('headwind-kiosk')
    .controller('AboutController', function ($scope, $rootScope, $modalInstance, APP_VERSION, localization,
                                             pluginService, rebranding, authService, PLUGIN_META) {

        rebranding.query(function(value) {
            $scope.line1Text = localization.localize('about.line.1').replace('${appName}', value.appName);
        });
        $scope.line3Text = localization.localize('about.line.3').replace('${versionNumber}', APP_VERSION);

        pluginService.getAvailablePlugins(function (response) {
            if (response.status === 'OK') {
                $scope.plugins = response.data.map(function (plugin) {
                    return localization.localize(plugin.nameLocalizationKey)
                }).sort();
                $scope.pluginList = $scope.plugins.join(', ');
                buildChips(response.data);
            }
        });

        // ---------------------------------------------------------------
        // Presentation (about.html): plugin chips with the Settings ->
        // Plugins page's icons (PLUGIN_META, plugins.controller.js), the
        // version copy and the links.
        // ---------------------------------------------------------------

        // "available" = enabled for this account; the installed-but-disabled
        // ones are the rest of the "active" (installed) list - the same
        // split the Plugins page makes
        var available = null;
        var installed = null;
        var buildChips = function (availableList) {
            if (availableList) {
                available = availableList;
            }
            if (!available) {
                return;
            }
            var enabledIds = {};
            available.forEach(function (plugin) {
                enabledIds[plugin.id] = true;
            });
            var all = installed || available;
            // "More plugins..." (xtra) isn't a feature - it's a link instead
            $scope.browseMoreState = null;
            var chips = [];
            all.forEach(function (plugin) {
                var meta = PLUGIN_META[plugin.identifier] || {};
                if (meta.browseMore) {
                    if (enabledIds[plugin.id]) {
                        $scope.browseMoreState = 'plugin-' + plugin.identifier;
                    }
                    return;
                }
                chips.push({
                    name: localization.localize(plugin.nameLocalizationKey),
                    icon: meta.icon || 'glyphicon-cog',
                    disabled: !enabledIds[plugin.id]
                });
            });
            chips.sort(function (a, b) {
                return a.disabled === b.disabled ? a.name.localeCompare(b.name) : (a.disabled ? 1 : -1);
            });
            $scope.pluginChips = chips;
        };

        pluginService.getActivePlugins(function (response) {
            if (response.status === 'OK' && response.data) {
                installed = response.data;
                buildChips();
            }
        });

        $scope.canManagePlugins = function () {
            return authService.hasPermission('plugins_customer_access_management');
        };

        // Text for the version pill's copy button (the shared appCopyButton,
        // which also handles plain-http pages and the toast) - for support
        // requests: the product line and version, and the installed plugins
        $scope.versionInfoText = function () {
            var lines = [($scope.line1Text || '') + ' ' + APP_VERSION];
            if ($scope.pluginChips && $scope.pluginChips.length) {
                lines.push(localization.localize('about.line.4') + ': ' + $scope.pluginChips.map(function (chip) {
                    return chip.name + (chip.disabled ? ' (' + localization.localize('about.plugin.disabled') + ')' : '');
                }).join(', '));
            }
            return lines.join('\n');
        };

        var listener = $scope.$on('aero_USER_LOGOUT', $modalInstance.dismiss);
        $scope.$on("$destroy", listener);

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }
    });
