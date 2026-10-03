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
angular.module('plugin-audit', ['ngResource', 'ui.bootstrap', 'ui.router', 'ngTagsInput', 'ncy-angular-breadcrumb'])
    .config(function ($stateProvider) {
        try {
            $stateProvider.state('plugin-audit', {
                url: "/" + 'plugin-audit',
                templateUrl: 'app/components/main/view/content.html',
                controller: 'TabController',
                ncyBreadcrumb: {
                    label: '{{"breadcrumb.plugin.audit.main" | localize}}', //label to show in breadcrumbs
                },
                resolve: {
                    openTab: function () {
                        return 'plugin-audit';
                    }
                },
            });
        } catch (e) {
            console.log('An error when adding state ' + 'plugin-audit', e);
        }
    })
    .factory('pluginAuditService', function ($resource) {
        return $resource('', {}, {
            lookupUsers: {url: 'rest/private/users/all', method: 'GET'},
            getLogs: {url: 'rest/plugins/audit/private/log/search', method: 'POST'},
        });
    })
    .controller('PluginAuditTabController', function ($scope, $rootScope, $window, $location, $interval, $http, $modal,
                                                      $filter, pluginAuditService, confirmModal, authService, localization) {

        $scope.hasPermission = authService.hasPermission;

        // Display-only formatting helpers - none of these touch the stored
        // log data, only how it's rendered in the table.
        var LOCALHOST_IPS = { '0:0:0:0:0:0:0:1': true, '::1': true, '127.0.0.1': true };
        $scope.formatIp = function (ip) {
            if (LOCALHOST_IPS[ip]) {
                return localization.localize('plugin.audit.ip.localhost');
            }
            return ip;
        };

        $scope.userInitial = function (login) {
            return login ? login.charAt(0).toUpperCase() : '?';
        };

        $scope.relativeTime = function (createTime) {
            var diffMs = Date.now() - createTime;
            var mins = Math.floor(diffMs / 60000);
            if (mins < 1) {
                return localization.localize('plugin.audit.time.justnow');
            }
            if (mins < 60) {
                return mins + ' ' + localization.localize('plugin.audit.time.minago');
            }
            var hours = Math.floor(mins / 60);
            if (hours < 24) {
                return hours + ' ' + localization.localize('plugin.audit.time.hourago');
            }
            var days = Math.floor(hours / 24);
            return days + ' ' + localization.localize('plugin.audit.time.dayago');
        };

        // Category color by keyword in the action key, not an exhaustive
        // per-action map - matches every action already listed in $scope.filters
        // below without needing to maintain a parallel lookup table. A failed
        // attempt (errorCode set) always reads as danger regardless of category.
        // Reuses the exact same color classes already shipped for the Logs/
        // Messaging/Push pages instead of adding audit-specific duplicates.
        $scope.actionBadgeClass = function (log) {
            if (log.errorCode) {
                return 'push-badge-danger';
            }
            var action = log.action || '';
            if (action.indexOf('remove') !== -1) {
                return 'push-badge-danger';
            }
            if (action.indexOf('login') !== -1) {
                return 'messaging-badge-delivered';
            }
            if (action.indexOf('reset') !== -1 || action.indexOf('lock') !== -1) {
                return 'push-badge-warn';
            }
            return 'push-badge-info';
        };

        function computeDayLabels(logs) {
            var todayStr = new Date().toDateString();
            var yesterdayStr = new Date(Date.now() - 86400000).toDateString();
            var lastLabel = null;
            logs.forEach(function (log) {
                var dStr = new Date(log.createTime).toDateString();
                var label;
                if (dStr === todayStr) {
                    label = localization.localize('plugin.audit.day.today');
                } else if (dStr === yesterdayStr) {
                    label = localization.localize('plugin.audit.day.yesterday');
                } else {
                    label = $filter('date')(log.createTime, 'd MMM yyyy');
                }
                log._dayLabel = (label !== lastLabel) ? label : null;
                lastLabel = label;
            });
        }

        $rootScope.settingsTabActive = false;
        $rootScope.pluginsTabActive = true;

        filters = [
            "plugin.audit.action.user.login",
            "plugin.audit.action.jwt.login",
            "plugin.audit.action.update.configuration",
            "plugin.audit.action.copy.configuration",
            "plugin.audit.action.remove.configuration",
            "plugin.audit.action.update.device",
            "plugin.audit.action.remove.device",
            "plugin.audit.action.update.application",
            "plugin.audit.action.update.webapp",
            "plugin.audit.action.remove.application",
            "plugin.audit.action.update.version",
            "plugin.audit.action.remove.version",
            "plugin.audit.action.update.file",
            "plugin.audit.action.remove.file",
            "plugin.audit.action.update.app.config",
            "plugin.audit.action.version.config",
            "plugin.audit.action.update.design",
            "plugin.audit.action.update.user.roles",
            "plugin.audit.action.update.language",
            "plugin.audit.action.update.plugins",
            "plugin.audit.action.update.user",
            "plugin.audit.action.remove.user",
            "plugin.audit.action.update.group",
            "plugin.audit.action.remove.group",
            "plugin.audit.action.password.changed",
            "plugin.audit.action.password.reset",
            "plugin.audit.action.device.reset",
            "plugin.audit.action.device.lock",
            "plugin.audit.action.update.update"
        ];
        $scope.filters = [{item: '', localized: localization.localize('plugin.audit.all.items')}];
        filters.forEach(function(item, index) {
            $scope.filters.push({item: item, localized: localization.localize(item)});
        });

        $scope.paging = {
            pageNum: 1,
            pageSize: 50,
            totalItems: 0,
            userFilter: null,
            messageFilter: '',
            dateFrom: null,
            dateTo: null,
        };

        $scope.$watch('paging.pageNum', function() {
            $window.scrollTo(0, 0);
        });

        $scope.dateFormat = localization.localize('format.date.plugin.audit.datePicker');
        $scope.createTimeFormat = localization.localize('format.date.plugin.audit.createTime');
        $scope.datePickerOptions = { 'show-weeks': false };
        $scope.openDatePickers = {
            'dateFrom': false,
            'dateTo': false
        };

        $scope.errorMessage = undefined;
        $scope.successMessage = undefined;

        $scope.openDateCalendar = function( $event, isStartDate ) {
            $event.preventDefault();
            $event.stopPropagation();

            if ( isStartDate ) {
                $scope.openDatePickers.dateFrom = true;
            } else {
                $scope.openDatePickers.dateTo = true;
            }
        };

        $scope.search = function () {
            $scope.errorMessage = undefined;

            if ($scope.paging.dateFrom && $scope.paging.dateTo) {
                if ($scope.paging.dateFrom > $scope.paging.dateTo) {
                    $scope.errorMessage = localization.localize('error.plugin.audit.date.range.invalid');
                    return;
                }
            }

            $scope.paging.pageNum = 1;
            loadData();
        };

        $scope.hasActiveFilters = function () {
            return !!($scope.paging.userFilter || $scope.paging.messageFilter ||
                $scope.paging.dateFrom || $scope.paging.dateTo);
        };

        $scope.clearFilter = function (name) {
            if (name === 'dateFrom' || name === 'dateTo') {
                $scope.paging[name] = null;
            } else if (name === 'messageFilter') {
                $scope.paging.messageFilter = '';
            } else {
                $scope.paging[name] = null;
            }
            $scope.search();
        };

        $scope.resetFilters = function () {
            $scope.paging.userFilter = null;
            $scope.paging.messageFilter = '';
            $scope.paging.dateFrom = null;
            $scope.paging.dateTo = null;
            $scope.search();
        };

        $scope.actionFilterLabel = function (value) {
            var match = $scope.filters.filter(function (f) { return f.item === value; });
            return match.length ? match[0].localized : '';
        };

        $scope.resultsRangeStart = function () {
            if (!$scope.paging.totalItems) {
                return 0;
            }
            return (($scope.paging.pageNum - 1) * $scope.paging.pageSize) + 1;
        };

        $scope.resultsRangeEnd = function () {
            return Math.min($scope.paging.pageNum * $scope.paging.pageSize, $scope.paging.totalItems || 0);
        };

        $scope.viewLog = function (log) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/plugins/audit/views/audit.modal.html',
                controller: 'PluginAuditModalController',
                resolve: {
                    log: function () {
                        return log;
                    }
                }
            });
        };

        $scope.$watch('paging.pageNum', function () {
            loadData();
        });

        $scope.getUsers = function(val) {
            return pluginAuditService.lookupUsers({filter: val}).$promise.then(function(response){
                if (response.status === 'OK') {
                    return response.data.map(function (user) {
                        return user.name;
                    });
                } else {
                    return [];
                }
            });
        };

        var loading = false;
        var loadData = function () {
            $scope.errorMessage = undefined;

            if (loading) {
                console.log("Skipping to query for list of log record since a previous request is pending");
                return;
            }

            loading = true;
            $scope.loading = true;

            var request = {};
            for (var p in $scope.paging) {
                if ($scope.paging.hasOwnProperty(p)) {
                    request[p] = $scope.paging[p];
                }
            }

            pluginAuditService.getLogs(request, function (response) {
                loading = false;
                $scope.loading = false;
                if (response.status === 'OK') {
                    $scope.logs = response.data.items;
                    $scope.paging.totalItems = response.data.totalItemsCount;
                    computeDayLabels($scope.logs);
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                loading = false;
                $scope.loading = false;
                $scope.errorMessage = localization.localize('error.request.failure');
            })
        };

        loadData();

        //
        // var autoUpdateInterval = $interval(loadData, 15000);
        // $scope.$on('$destroy', function () {
        //     if (autoUpdateInterval) $interval.cancel(autoUpdateInterval);
        // });

    })
    .controller('PluginAuditModalController',
        function ($scope, $timeout, $modalInstance, log, localization) {
            $scope.createTimeFormat = localization.localize('format.date.plugin.audit.createTime');
            $scope.log = log;
            $scope.closeModal = function () {
                $modalInstance.dismiss();
            };

            $scope.formattedPayload = function () {
                if (!log.payload) {
                    return log.payload;
                }
                try {
                    return JSON.stringify(JSON.parse(log.payload), null, 2);
                } catch (e) {
                    return log.payload;
                }
            };
    })
    .run(function ($rootScope, $location, localization) {
        localization.loadPluginResourceBundles("audit");
    });


