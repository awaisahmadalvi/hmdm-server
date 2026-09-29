// Localization completed
angular.module('headwind-kiosk')
    .controller('GroupsTabController', function ($scope, $rootScope, $timeout, $state, $modal, alertService, confirmModal,
                                                 groupService, $window, localization) {
        $scope.search = {};
        $scope.loading = false;

        $scope.paging = {
            currentPage: 1,
            pageSize: 50
        };

        $scope.$watch('paging.currentPage', function () {
            $window.scrollTo(0, 0);
        });

        $scope.init = function () {
            $rootScope.settingsTabActive = true;
            $rootScope.pluginsTabActive = false;
            $scope.paging.currentPage = 1;
            $scope.search();
        };

        $scope.search = function () {
            $scope.loading = true;
            groupService.getAllGroups({value: $scope.search.searchValue},
                function (response) {
                    $scope.loading = false;
                    $scope.groups = response.data;
                    $scope.paging.currentPage = 1;
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

        $scope.groupsToast = null;

        var showGroupsToast = function (type, message) {
            $scope.groupsToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.groupsToast && $scope.groupsToast.message === message) {
                    $scope.groupsToast = null;
                }
            }, 3000);
        };

        $scope.editGroup = function (group) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/group.html',
                controller: 'GroupModalController',
                resolve: {
                    group: function () {
                        return group;
                    },
                    existingGroups: function () {
                        return $scope.groups;
                    }
                }
            });

            modalInstance.result.then(function (result) {
                $scope.search();
                if (result) {
                    showGroupsToast('success', localization.localize('success.group.saved'));
                }
            });
        };

        $scope.removeGroup = function (group) {
            // The default ("General") group has id 1 - there is no
            // server-side protection against deleting it (verified: the
            // backend has no such check), so this frontend guard is the
            // only thing stopping it. Kept as the exact same condition the
            // old greyed-out button used, now also enforced here rather
            // than relying solely on the button not being rendered.
            if (group.id === 1) {
                return;
            }
            let localizedText = localization.localize('question.delete.group').replace('${groupName}', group.name) +
                ' ' + localization.localize('question.delete.user.warning');
            confirmModal.getUserConfirmation(localizedText, function () {
                groupService.removeGroup({id: group.id}, function (response) {
                    if (response.status === 'OK') {
                        $scope.search();
                    } else {
                        showGroupsToast('error', localization.localize('error.notempty.group'));
                    }
                }, function () {
                    showGroupsToast('error', localization.localize('error.request.failure'));
                });
            });
        };

        $scope.init();
    })
    .controller('GroupModalController', function ($scope, $modalInstance, groupService, group, existingGroups, localization) {
        $scope.group = {};
        for (var prop in group) {
            if (group.hasOwnProperty(prop)) {
                $scope.group[prop] = group[prop];
            }
        }

        $scope.isDuplicateName = function () {
            var name = ($scope.group.name || '').trim().toLowerCase();
            if (!name) {
                return false;
            }
            return (existingGroups || []).some(function (g) {
                return g.name && g.name.toLowerCase() === name && g.id !== $scope.group.id;
            });
        };

        $scope.savingGroup = false;

        $scope.save = function () {
            $scope.errorMessage = '';

            if (!$scope.group.name) {
                $scope.errorMessage = localization.localize('error.empty.group.name');
            } else if ($scope.isDuplicateName()) {
                $scope.errorMessage = localization.localize('error.duplicate.group.name');
            } else {
                var request = {};
                for (var prop in $scope.group) {
                    if ($scope.group.hasOwnProperty(prop)) {
                        request[prop] = $scope.group[prop];
                    }
                }

                $scope.savingGroup = true;
                groupService.updateGroup(request, function (response) {
                    $scope.savingGroup = false;
                    if (response.status === 'OK') {
                        $modalInstance.close(true);
                    } else {
                        $scope.errorMessage = localization.localize('error.duplicate.group.name');
                    }
                }, function () {
                    $scope.savingGroup = false;
                    $scope.errorMessage = localization.localize('error.request.failure');
                });
            }
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }
    });
