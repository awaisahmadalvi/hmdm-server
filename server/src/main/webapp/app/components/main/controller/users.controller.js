// Localization completed
angular.module('headwind-kiosk')
    .controller('UsersTabController', function ($scope, $rootScope, $timeout, $state, userService, $modal, confirmModal,
                                                alertService, authService, $window, localization, utils) {

        $scope.search = {};

        $scope.paging = {
            currentPage: 1,
            pageSize: 50
        };

        $scope.$watch('paging.currentPage', function () {
            $window.scrollTo(0, 0);
        });

        $scope.users = [];
        $scope.currentUser = {};
        userService.getCurrent(function (response) {
            if (response.data) {
                $scope.currentUser = response.data;
            }
        });

        $scope.userRoles = [];
        userService.getUserRoles(function (response) {
            if (response.status === 'OK') {
                $scope.userRoles = response.data;
            }
        });

        $scope.roleFilter = null; // null = "All roles"

        $scope.setRoleFilter = function (roleId) {
            $scope.roleFilter = roleId;
            $scope.paging.currentPage = 1;
        };

        $scope.filteredUsers = function () {
            if (!$scope.roleFilter) {
                return $scope.users;
            }
            return $scope.users.filter(function (user) {
                return user.userRole && user.userRole.id === $scope.roleFilter;
            });
        };

        $scope.pagedUsers = function () {
            var list = $scope.filteredUsers();
            var start = (($scope.paging.currentPage - 1) * $scope.paging.pageSize);
            return list.slice(start, start + $scope.paging.pageSize);
        };

        $scope.userInitials = function (user) {
            var source = user.name || user.login || '';
            return source.substring(0, 1).toUpperCase();
        };

        $scope.isCurrentUser = function (user) {
            return !!($scope.currentUser && user && $scope.currentUser.id === user.id);
        };

        // Shared with the User roles page (utils.roleBadgeClass) so a role
        // reads as the same color on both pages.
        $scope.roleBadgeClass = function (user) {
            var name = user.userRole && user.userRole.name;
            return utils.roleBadgeClass(name, user.superAdmin);
        };

        $scope.loading = false;

        $scope.init = function () {
            $rootScope.settingsTabActive = true;
            $rootScope.pluginsTabActive = false;
            $scope.loading = true;
            userService.getAll(function (response) {
                $scope.loading = false;
                if (response.data) {
                    $scope.users = response.data;
                }
            });

        };

        $scope.search = function () {
            $scope.loading = true;
            userService.getAll({filter: $scope.search.searchValue},
                function (response) {
                    $scope.loading = false;
                    $scope.users = response.data;
                    $scope.paging.currentPage = 1;
                });
        };

        $scope.clearSearch = function () {
            $scope.search.searchValue = '';
            $scope.search();
        };

        // Live search: debounce while typing, reusing the exact same
        // search() the Enter key already triggers - not a separate
        // search path.
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

        $scope.usersToast = null;

        var showUsersToast = function (type, message) {
            $scope.usersToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.usersToast && $scope.usersToast.message === message) {
                    $scope.usersToast = null;
                }
            }, 3000);
        };

        $scope.editUser = function (user) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/user.html',
                controller: 'UserModalController',
                size: 'lg',
                resolve: {
                    user: function () {
                        return user;
                    }
                }
            });

            modalInstance.result.then(function (result) {
                $scope.search();
                if (result) {
                    showUsersToast('success', localization.localize('success.user.saved'));
                }
            });
        };

        $scope.removeUser = function (user) {
            if ($scope.isCurrentUser(user)) {
                return;
            }
            let localizedText = localization.localize('question.delete.user').replace('${username}', user.name) +
                ' ' + localization.localize('question.delete.user.warning');
            confirmModal.getUserConfirmation(localizedText, function () {
                userService.remove({id: user.id}, function (response) {
                    if (response.status === 'OK') {
                        $scope.search();
                    } else {
                        alertService.showAlertMessage(localization.localize('error.internal.server'));
                    }
                });
            });
        };

        $scope.loginAs = function (user) {
            let localizedText = localization.localize('question.change.user').replace('${userName}', user.name);
            confirmModal.getUserConfirmation(localizedText, function () {
                userService.loginAs({id: user.id}, function (response) {
                    if (response.status === 'OK') {
                        var user = response.data;
                        authService.update(user);
                        $state.transitionTo( 'main' );
                        $rootScope.$emit('aero_USER_AUTHENTICATED');
                    } else {
                        alertService.showAlertMessage(localization.localize(response.message));
                    }
                });
            });
        };

        $scope.init();
    })
    //*******************************************************************************************************************
    .controller('UserModalController', function ($scope, $modalInstance, userService, user, groupService,
                                                 configurationService, localization, settingsService, passwordService) {
        $scope.groupsList = [];

        groupService.getAllGroups(function (response) {
            $scope.groupsList = response.data.map(function (group) {
                return {id: group.id, label: group.name};
            });
        });

        configurationService.getAllConfigNames(function (response) {
            $scope.configsList = response.data.map(function (config) {
                return {id: config.id, label: config.name};
            });
        });

        settingsService.getSettings(function (response) {
            if (response.data) {
                $scope.settings = response.data;
                $scope.qualityMessage = passwordService.qualityMessage($scope.settings.passwordLength, $scope.settings.passwordStrength);
            }
        });

        $scope.groupsSelection = (user.groups || []).map(function (group) {
            return {id: group.id};
        });

        $scope.configSelection = (user.configurations || []).map(function (configuration) {
            return {id: configuration.id};
        });

        $scope.tableGroupsTexts = {
            'buttonDefaultText': localization.localize('table.filtering.no.selected.group'),
            'checkAll': localization.localize('table.filtering.check.all'),
            'uncheckAll': localization.localize('table.filtering.uncheck.all'),
            'dynamicButtonTextSuffix': localization.localize('table.filtering.suffix.group')
        };

        $scope.tableConfigsTexts = {
            'buttonDefaultText': localization.localize('table.filtering.no.selected.configuration'),
            'checkAll': localization.localize('table.filtering.check.all'),
            'uncheckAll': localization.localize('table.filtering.uncheck.all'),
            'dynamicButtonTextSuffix': localization.localize('table.filtering.suffix.configuration')
        };

        var resetMessages = function () {
            $scope.errorMessage = '';
            $scope.completeMessage = '';
        };

        $scope.user = {
            userRole: {}
        };

        $scope.userRoles = [];

        userService.getUserRoles(function (response) {
            if (response.status === 'OK') {
                $scope.userRoles = response.data;
            } else {
                console.error('Failed to get the list of user roles: ', response.message);
            }
        });

        for (var prop in user) {
            if (user.hasOwnProperty(prop)) {
                $scope.user[prop] = user[prop];
            }
        }

        // New users always need a password up front; existing users only
        // see the password fields once they explicitly opt to change it.
        $scope.changingPassword = !user.id;
        $scope.showPassword = false;
        $scope.showConfirm = false;

        $scope.startChangingPassword = function () {
            $scope.changingPassword = true;
        };

        $scope.savingUser = false;

        $scope.save = function () {
            $scope.errorMessage = '';

            if (($scope.user.newPassword || $scope.user.confirm) && $scope.user.newPassword !== $scope.user.confirm) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.mismatch.password');
            } else if (($scope.user.newPassword || $scope.user.confirm) &&
                !passwordService.checkQuality($scope.user.newPassword, $scope.settings.passwordLength, $scope.settings.passwordStrength)) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.password.weak');
            } else if (!$scope.user.login) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.empty.user.login');
            } else if (!$scope.user.name) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.empty.user.name');
            } else if (!$scope.user.userRole.id) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.empty.user.role');
            } else {
                var request = {};
                for (var prop in $scope.user) {
                    if ($scope.user.hasOwnProperty(prop)) {
                        request[prop] = $scope.user[prop];
                    }
                }
                if ($scope.user.newPassword && $scope.user.confirm) {
                    request["newPassword"] = md5($scope.user.newPassword).toUpperCase();
                    request["confirmModal"] = md5($scope.user.confirm).toUpperCase();
                } else {
                    request["newPassword"] = undefined;
                    request["confirmModal"] = undefined;
                }

                if ($scope.user.allDevicesAvailable) {
                    request.groups = null;
                } else {
                    request["allDevicesAvailable"] = false;
                    request.groups = $scope.groupsSelection;
                }

                if ($scope.user.allConfigAvailable) {
                    request.configurations = null;
                } else {
                    request["allConfigAvailable"] = false;
                    request.configurations = $scope.configSelection;
                }

                $scope.savingUser = true;
                userService.update(request, function (response) {
                    $scope.savingUser = false;
                    if (response.status === 'OK') {
                        $modalInstance.close(true);
                    } else {
                        $scope.errorMessage = localization.localizeServerResponse(response);
                    }
                }, function () {
                    $scope.savingUser = false;
                    $scope.errorMessage = localization.localize('error.request.failure');
                });
            }
        };


        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }
    });