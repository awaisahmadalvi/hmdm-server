// Localization completed
angular.module('headwind-kiosk')
    .controller('ProfileController', function ($scope, authService, userService, settingsService,
                                               localization, passwordService, fileService, alertService, utils) {
        var resetMessages = function () {
            $scope.errorMessage = '';
            $scope.completeMessage = '';
        };

        $scope.user = authService.getUser();
        $scope.user.newPassword = '';
        $scope.user.confirm = '';

        $scope.errorMessage = '';
        $scope.completeMessage = '';
        // Which card the current errorMessage belongs to ('details' /
        // 'password') - both saves share errorMessage
        $scope.errorSource = null;

        // ---------------------------------------------------------------
        // Presentation only (profile.html): page header, change detection,
        // password field toggles, strength meter and rules checklist.
        // ---------------------------------------------------------------

        // The saved user, for the page header (not the form being edited)
        $scope.savedUser = authService.getUser();

        $scope.initials = function () {
            var source = ($scope.savedUser.name || $scope.savedUser.login || '').trim();
            var words = source.split(/\s+/).filter(function (w) {
                return w.length > 0;
            });
            var letters = words.length > 1 ? words[0].charAt(0) + words[words.length - 1].charAt(0) : source.substring(0, 2);
            return letters.toUpperCase();
        };

        // Same role colors as the Users / User roles pages
        $scope.roleBadgeClass = function () {
            var role = $scope.savedUser.userRole;
            return utils.roleBadgeClass(role && role.name, $scope.savedUser.superAdmin);
        };

        $scope.detailsChanged = function () {
            return ($scope.user.name || '') !== ($scope.savedUser.name || '') ||
                ($scope.user.email || '') !== ($scope.savedUser.email || '');
        };

        $scope.showPassword = {old: false, new: false, confirm: false};

        // Rebuilt only when the password or the rules change: the checklist's
        // ng-repeat watches this list, and a fresh array of fresh objects on
        // every digest never settles - an infinite digest, which (thrown from
        // the form's submit handler) also skipped its preventDefault and let
        // the browser submit the form natively, putting the passwords in the
        // URL
        var rulesCache = {key: null, rules: []};
        $scope.passwordRules = function () {
            if (!$scope.settings) {
                return rulesCache.rules;
            }
            var key = [$scope.user.newPassword || '', $scope.settings.passwordLength, $scope.settings.passwordStrength].join('\u0000');
            if (key !== rulesCache.key) {
                rulesCache = {
                    key: key,
                    rules: passwordService.ruleChecks($scope.user.newPassword, $scope.settings.passwordLength, $scope.settings.passwordStrength)
                };
            }
            return rulesCache.rules;
        };

        $scope.passwordStrength = function () {
            return passwordService.strength($scope.user.newPassword);
        };

        $scope.passwordFilled = function () {
            return !!($scope.user.oldPassword && $scope.user.newPassword && $scope.user.confirm);
        };

        $scope.passwordsMatch = function () {
            return $scope.user.newPassword === $scope.user.confirm;
        };

        $scope.savingDetails = false;
        $scope.savingPassword = false;

        var onRequestFailure = function () {
            $scope.savingDetails = false;
            $scope.savingPassword = false;
            alertService.error(localization.localize('error.request.failure'));
        };

        $scope.now = (new Date()) * 1;
        $scope.accountType = function(type) {
            switch (type) {
                case 0:
                    return localization.localize('customer.type.demo');
                case 1:
                    return localization.localize('customer.type.small');
                case 2:
                    return localization.localize('customer.type.corporate');
            }
            return '';
        };

        $scope.saveDetails = function() {
            var user = {};
            for (var p in $scope.user) {
                if ($scope.user.hasOwnProperty(p)) {
                    user[p] = $scope.user[p];
                }
            }
            $scope.errorSource = 'details';
            $scope.savingDetails = true;
            userService.updateDetails(user, function (response) {
                resetMessages();
                $scope.savingDetails = false;

                if (response.status === 'OK') {
                    authService.update(response.data);
                    $scope.user = authService.getUser();
                    $scope.savedUser = authService.getUser();
                    $scope.completeMessage = localization.localizeServerResponse(response);
                    alertService.success(localization.localize('form.profile.updated'));
                    if ($scope.profileForm) {
                        $scope.profileForm.$setPristine();
                        $scope.profileForm.$setUntouched();
                    }
                } else if (response.status === 'ERROR') {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                    alertService.error($scope.errorMessage);
                }
            }, onRequestFailure);
        };

        $scope.saveProfile = function() {
            $scope.errorSource = 'password';
            if ($scope.user.newPassword !== $scope.user.confirm) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.mismatch.password');
                return;
            }

            if ($scope.user.newPassword == '') {
                resetMessages();
                $scope.errorMessage = localization.localize('error.password.empty');
                return;
            }

            if (!passwordService.checkQuality($scope.user.newPassword, $scope.settings.passwordLength, $scope.settings.passwordStrength)) {
                resetMessages();
                $scope.errorMessage = localization.localize('error.password.weak');
                return;
            }

            var user = {};
            for (var p in $scope.user) {
                if ($scope.user.hasOwnProperty(p)) {
                    user[p] = $scope.user[p];
                }
            }

            user.newPassword = user.newPassword ? md5(user.newPassword).toUpperCase() : undefined;
            user.oldPassword = user.oldPassword ? md5(user.oldPassword).toUpperCase() : undefined;

            $scope.savingPassword = true;
            userService.updatePassword(user, function (response) {
                resetMessages();
                $scope.savingPassword = false;

                if (response.status === 'OK') {
                    authService.update(response.data);
                    $scope.user = authService.getUser();
                    $scope.savedUser = authService.getUser();
                    $scope.completeMessage = localization.localizeServerResponse(response);
                    // Clear the password fields (the user object from the
                    // server never carries them, but be explicit)
                    $scope.user.oldPassword = '';
                    $scope.user.newPassword = '';
                    $scope.user.confirm = '';
                    $scope.showPassword = {old: false, new: false, confirm: false};
                    if ($scope.passwordForm) {
                        $scope.passwordForm.$setPristine();
                        $scope.passwordForm.$setUntouched();
                    }
                    alertService.success(localization.localize('form.profile.password.changed'));
                } else if (response.status === 'ERROR') {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                    alertService.error($scope.errorMessage);
                }
            }, onRequestFailure);
        };

        $scope.saveEnabled = false;
        settingsService.getSettings(function (response) {
            if (response.data) {
                $scope.settings = response.data;
                $scope.sizeLimit = $scope.settings.sizeLimit;
                $scope.qualityMessage = passwordService.qualityMessage($scope.settings.passwordLength, $scope.settings.passwordStrength);
                $scope.saveEnabled = true;
            }
        });

        fileService.getLimit(function(response) {
            if (response.status === 'OK' &&
                response.data.sizeLimit > 0) {
                $scope.sizeLimit = response.data.sizeUsed + " / " + response.data.sizeLimit;
            }
        });

    });
