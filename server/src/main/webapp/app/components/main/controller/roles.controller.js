// Localization completed
angular.module('headwind-kiosk')
    .controller('RolesTabController', function ($scope, $rootScope, $timeout, $state, $modal, alertService, confirmModal,
                                                 roleService, userService, utils, $window, localization) {
        $scope.loading = false;
        $scope.roles = [];
        $scope.permissions = [];
        $scope.builtInRole = null;

        var allUserRoles = null;

        // The built-in admin role is deliberately excluded from
        // roleService.getRoles() (server-side: "Admin cannot edit admin
        // permissions"). To still show it as a read-only card, cross
        // reference it against the unfiltered role list already used by
        // the Users page (userService.getUserRoles) - no new backend
        // endpoint, and if that role is missing for any reason, it's
        // simply skipped rather than hardcoded.
        var computeBuiltInRole = function () {
            if (!$scope.roles || !allUserRoles) {
                return;
            }
            var customIds = {};
            $scope.roles.forEach(function (role) {
                customIds[role.id] = true;
            });
            $scope.builtInRole = null;
            for (var i = 0; i < allUserRoles.length; i++) {
                if (!customIds[allUserRoles[i].id]) {
                    $scope.builtInRole = allUserRoles[i];
                    $scope.builtInRole.builtIn = true;
                    break;
                }
            }
        };

        var permissionLabelById = {};

        $scope.init = function () {
            $rootScope.settingsTabActive = true;
            $rootScope.pluginsTabActive = false;
            $scope.search();
        };

        $scope.search = function () {
            $scope.loading = true;

            roleService.getPermissions(function (response) {
                $scope.permissions = response.data;
                permissionLabelById = {};
                $scope.permissions.forEach(function (permission) {
                    permissionLabelById[permission.id] = localization.localize('permission.' + permission.name);
                });
            });

            roleService.getRoles(function (response) {
                $scope.loading = false;
                $scope.roles = response.data;
                computeBuiltInRole();
            });

            userService.getUserRoles(function (response) {
                if (response.status === 'OK') {
                    allUserRoles = response.data;
                    computeBuiltInRole();
                }
            });
        };

        $scope.roleBadgeClass = function (role) {
            return utils.roleBadgeClass(role.name, role.builtIn);
        };

        $scope.roleChips = function (role, limit) {
            var perms = role.permissions || [];
            var labels = perms.map(function (p) {
                return permissionLabelById[p.id];
            }).filter(function (label) {
                return !!label;
            });
            return {
                shown: labels.slice(0, limit),
                more: Math.max(0, labels.length - limit)
            };
        };

        $scope.rolesToast = null;

        var showRolesToast = function (type, message) {
            $scope.rolesToast = {type: type, message: message};
            $timeout(function () {
                if ($scope.rolesToast && $scope.rolesToast.message === message) {
                    $scope.rolesToast = null;
                }
            }, 3000);
        };

        $scope.editRole = function (role) {
            var modalInstance = $modal.open({
                templateUrl: 'app/components/main/view/modal/role.html',
                controller: 'RoleModalController',
                size: 'lg',
                resolve: {
                    role: function () {
                        return role;
                    },
                    permissions: function () {
                        return $scope.permissions;
                    },
                    existingRoles: function () {
                        return $scope.roles;
                    }
                }
            });

            modalInstance.result.then(function (result) {
                $scope.search();
                if (result) {
                    showRolesToast('success', localization.localize('success.role.saved'));
                }
            });
        };

        $scope.removeRole = function (role) {
            let localizedText = localization.localize('question.delete.role').replace('${roleName}', role.name) +
                ' ' + localization.localize('question.delete.user.warning');
            confirmModal.getUserConfirmation(localizedText, function () {
                roleService.removeRole({id: role.id}, function (response) {
                    if (response.status === 'OK') {
                        $scope.search();
                    } else {
                        showRolesToast('error', localization.localizeServerResponse(response));
                    }
                }, function () {
                    showRolesToast('error', localization.localize('error.request.failure'));
                });
            });
        };

        $scope.init();
    })
    //*******************************************************************************************************************
    .controller('RoleModalController', function ($scope, $modalInstance, roleService, role, permissions, existingRoles, localization) {
        $scope.role = {};
        for (var prop in role) {
            if (role.hasOwnProperty(prop)) {
                $scope.role[prop] = role[prop];
            }
        }

        $scope.permissionList = permissions.map(function (permission) {
            return {
                id: permission.id,
                name: permission.name,
                label: localization.localize('permission.' + permission.name)
            };
        });

        // Small config mapping permission name keywords to a display group -
        // not one hardcoded row of markup per permission. Anything matching
        // none of these keywords falls into "Other".
        var PERMISSION_GROUP_RULES = [
            {id: 'devices', titleKey: 'form.role.group.devices', keywords: ['device', 'knox', 'apuppet', 'urlfilter']},
            {id: 'applications', titleKey: 'form.role.group.applications', keywords: ['application']},
            {id: 'configurations', titleKey: 'form.role.group.configurations', keywords: ['config']},
            {id: 'files', titleKey: 'form.role.group.files', keywords: ['file']},
            {id: 'settings', titleKey: 'form.role.group.settings', keywords: ['settings', 'plugins_customer_access_management', 'get_updates']},
            {id: 'functions', titleKey: 'form.role.group.functions', keywords: ['messaging', 'push', 'audit', 'contacts', 'photo', 'openvpn', 'xtra', 'licensing']}
        ];

        var classifyPermission = function (name) {
            for (var i = 0; i < PERMISSION_GROUP_RULES.length; i++) {
                var rule = PERMISSION_GROUP_RULES[i];
                for (var j = 0; j < rule.keywords.length; j++) {
                    if (name.indexOf(rule.keywords[j]) !== -1) {
                        return rule.id;
                    }
                }
            }
            return 'other';
        };

        $scope.permissionGroups = (function () {
            var byGroup = {};
            $scope.permissionList.forEach(function (perm) {
                var groupId = classifyPermission(perm.name);
                if (!byGroup[groupId]) {
                    byGroup[groupId] = [];
                }
                byGroup[groupId].push(perm);
            });
            var titleKeys = {other: 'form.role.group.other'};
            PERMISSION_GROUP_RULES.forEach(function (rule) {
                titleKeys[rule.id] = rule.titleKey;
            });
            var idsInOrder = PERMISSION_GROUP_RULES.map(function (rule) {
                return rule.id;
            }).concat(['other']);
            return idsInOrder.filter(function (id) {
                return byGroup[id] && byGroup[id].length > 0;
            }).map(function (id) {
                return {id: id, titleKey: titleKeys[id], permissions: byGroup[id]};
            });
        })();

        $scope.permissionSelection = (role.permissions || []).map(function (permission) {
            return {id: permission.id};
        });

        $scope.isPermissionSelected = function (id) {
            return $scope.permissionSelection.some(function (p) {
                return p.id === id;
            });
        };

        $scope.togglePermission = function (id) {
            var idx = -1;
            for (var i = 0; i < $scope.permissionSelection.length; i++) {
                if ($scope.permissionSelection[i].id === id) {
                    idx = i;
                    break;
                }
            }
            if (idx >= 0) {
                $scope.permissionSelection.splice(idx, 1);
            } else {
                $scope.permissionSelection.push({id: id});
            }
        };

        $scope.groupEnabledCount = function (group) {
            var count = 0;
            group.permissions.forEach(function (p) {
                if ($scope.isPermissionSelected(p.id)) {
                    count++;
                }
            });
            return count;
        };

        $scope.setGroupAll = function (group, value) {
            group.permissions.forEach(function (p) {
                var selected = $scope.isPermissionSelected(p.id);
                if (value !== selected) {
                    $scope.togglePermission(p.id);
                }
            });
        };

        $scope.permissionSearch = '';

        $scope.visibleGroups = function () {
            var query = ($scope.permissionSearch || '').toLowerCase().trim();
            if (!query) {
                return $scope.permissionGroups;
            }
            return $scope.permissionGroups.map(function (group) {
                return {
                    id: group.id,
                    titleKey: group.titleKey,
                    permissions: group.permissions.filter(function (p) {
                        return p.label.toLowerCase().indexOf(query) !== -1;
                    })
                };
            }).filter(function (group) {
                return group.permissions.length > 0;
            });
        };

        $scope.collapsedGroups = {};

        $scope.toggleGroupCollapsed = function (groupId) {
            $scope.collapsedGroups[groupId] = !$scope.collapsedGroups[groupId];
        };

        $scope.tablePermissionTexts = {
            'buttonDefaultText': localization.localize('table.filtering.no.selected.permission'),
            'checkAll': localization.localize('table.filtering.check.all'),
            'uncheckAll': localization.localize('table.filtering.uncheck.all'),
            'dynamicButtonTextSuffix': localization.localize('table.filtering.suffix.permission')
        };

        $scope.isDuplicateName = function () {
            var name = ($scope.role.name || '').trim().toLowerCase();
            if (!name) {
                return false;
            }
            return (existingRoles || []).some(function (r) {
                return r.name && r.name.toLowerCase() === name && r.id !== $scope.role.id;
            });
        };

        $scope.savingRole = false;

        $scope.save = function () {
            $scope.errorMessage = '';

            if (!$scope.role.name) {
                $scope.errorMessage = localization.localize('error.empty.role.name');
            } else if ($scope.isDuplicateName()) {
                $scope.errorMessage = localization.localize('error.duplicate.role.name');
            } else {
                var request = {};
                for (var prop in $scope.role) {
                    if ($scope.role.hasOwnProperty(prop)) {
                        request[prop] = $scope.role[prop];
                    }
                }
                request.permissions = $scope.permissionSelection;

                $scope.savingRole = true;
                roleService.updateRole(request, function (response) {
                    $scope.savingRole = false;
                    if (response.status === 'OK') {
                        $modalInstance.close(true);
                    } else {
                        $scope.errorMessage = localization.localize('error.duplicate.role.name');
                    }
                }, function () {
                    $scope.savingRole = false;
                    $scope.errorMessage = localization.localize('error.request.failure');
                });
            }
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        }
    });
