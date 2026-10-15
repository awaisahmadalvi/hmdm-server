// Localization completed
angular.module('headwind-kiosk')
    .controller('TabController', function ($scope, $rootScope, $timeout, userService, authService, openTab, $state,
                                           pluginService, localization, hintService) {

        $scope.localization = localization;

        var routes = {
            SUMMARY: 'summary',
            DEVICES: 'main',
            APPS: 'applications',
            CONFS: 'configurations',
            FILES: 'files',
            DESIGN: 'designSettings',
            COMMON: 'commonSettings',
            USERS: 'users',
            ROLES: 'roles',
            GROUPS: 'groups',
            ICONS: 'icons',
            LANG: 'langSettings',
            HINTS: 'hints',
            PLUGINS: 'pluginSettings'
        };

        var loadData = function () {
            pluginService.getAvailablePlugins(function (response) {
                if (response.status === 'OK') {
                    if (response.data) {
                        // Plugins available for Functions tab
                        $scope.functionsPlugins = response.data.filter(function (plugin) {
                            return plugin.functionsViewTemplate !== undefined && plugin.functionsViewTemplate !== null;
                        });
                        $scope.functionsPlugins.forEach(function (plugin) {
                            let ID = 'plugin-' + plugin.identifier;
                            routes[ID] = ID;
                        });

                        // Plugins available for Settings tab
                        $scope.settingsPlugins = response.data.filter(function (plugin) {
                            return plugin.settingsViewTemplate !== undefined && plugin.settingsViewTemplate !== null;
                        });
                        $scope.settingsPlugins.forEach(function (plugin) {
                            let ID = 'plugin-settings-' + plugin.identifier;
                            routes[ID] = ID;
                        });
                    }
                } else {
                    $scope.functionsPlugins = [];
                    $scope.settingsPlugins = [];
                }
            });
        };

        $scope.currentUser = {};

        $scope.hasPermission = authService.hasPermission;
        $scope.canManageRoles = function() {
            return authService.isSingleCustomer() || authService.isSuperAdmin();
        };

        $scope.activeTab = openTab;

        $scope.act = {};
        $scope.act[openTab] = true;

        // The configuration editor (configEditor state) shares this
        // controller/template with the Configurations list (both resolve
        // openTab to 'CONFS') so the main nav renders on the editor page
        // too - content.html picks between configurations.html and
        // configuration.html based on this flag. See app.js's configEditor
        // state for the full rationale.
        $scope.isConfigEditor = ($state.current.name === 'configEditor');

        // Same fix, same reason, for the application versions page
        // (appVersionsEditor state) - shares this controller/template with
        // the Applications list (both resolve openTab to 'APPS') so the
        // main nav renders there too; content.html picks between
        // applications.html and applicationVersions.html based on this
        // flag. See app.js's appVersionsEditor state for the full rationale.
        $scope.isVersionsEditor = ($state.current.name === 'appVersionsEditor');

        // appShellPage() routes (app.js): the page template rendered in
        // content.html's hidden PAGE tab
        $scope.pageTemplate = ($state.current.data || {}).pageTemplate;
        // The Settings / Functions dropdowns' active flags, set from this
        // route's tab. Individual pages also set them when they load, but
        // nothing cleared them on a route that isn't one of those pages, so
        // e.g. the Configuration editor opened right after a Settings page
        // showed both Configurations and Settings as active.
        // appShellPage() routes name their menu, if any, via data.navSection.
        var SETTINGS_TABS = ['DESIGN', 'COMMON', 'USERS', 'ROLES', 'GROUPS', 'ICONS', 'LANG', 'HINTS', 'PLUGINS'];
        var navSection = ($state.current.data || {}).navSection;
        $rootScope.settingsTabActive = SETTINGS_TABS.indexOf(openTab) !== -1 || openTab.indexOf('plugin-settings-') === 0 ||
            navSection === 'settings';
        $rootScope.pluginsTabActive = (openTab.indexOf('plugin-') === 0 && openTab.indexOf('plugin-settings-') !== 0) ||
            navSection === 'functions';

        $scope.functionsPlugins = [];
        $scope.settingsPlugins = [];

        $scope.openTab = function (tabName) {
            if (tabName === $scope.activeTab && !$scope.isConfigEditor && !$scope.isVersionsEditor) {
                return;
            }
            if (routes[tabName]) {
                $state.transitionTo(routes[tabName]);
            }
        };

        var listener = $scope.$on('aero_PLUGINS_UPDATED', loadData);
        $scope.$on('$destroy', listener);

        userService.getCurrent(function (response) {
            if (response.data) {
                $scope.currentUser = response.data;
            }
        });

        // hintService start is fired by the controllers themselves after they are loaded all required content
//        $timeout(function () {
//            hintService.onStateChangeSuccess();
//        }, 100);

        loadData();
    });
