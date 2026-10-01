// Localization completed
angular.module('headwind-kiosk')
    .controller('QRController', function ($state, $scope, $window, $stateParams, $http, $location,
                                          localization, hintService, groupService, $timeout, rebranding, alertService,
                                          authService) {
        $scope.deviceId = $stateParams.deviceId;

        var configName = $location.search().name;
        $scope.configName = configName || '';

        $scope.printQr = function () {
            $window.print();
        };

        $scope.formData = {
            deviceIdNew: $stateParams.deviceId,
            groups: null
        };

        $scope.qrCodeKey = $stateParams.qrCode;
        $scope.devices = [];
        $scope.device = {};
        $scope.showQR = true;

        // Fixed on-screen size (was dynamically recomputed to 80% of the
        // viewport on every renew() before) - the card now has a stable,
        // deliberate size and scales down responsively via CSS instead.
        // downloadSize is requested only for the PNG download link, kept
        // separate from the on-screen size so the download is always
        // high-resolution regardless of how big the on-screen code is.
        $scope.size = 420;
        $scope.downloadSize = 1024;

        $scope.appName = '';
        rebranding.query(function(value) {
            $scope.qrCodeHelpLine5 = localization.localize('qrcode.help.line5').replace('${appName}', value.appName);
            $scope.appName = value.appName;
        });

        // Brief "QR updated" flash on the QR card - triggered explicitly
        // from the options form's change handlers (not from inside renew()
        // itself), so the very first, initial renew() call below never
        // flashes anything.
        $scope.qrJustUpdated = false;
        var flashTimeout;
        $scope.flashQrUpdated = function () {
            $scope.qrJustUpdated = true;
            if (flashTimeout) {
                $timeout.cancel(flashTimeout);
            }
            flashTimeout = $timeout(function () {
                $scope.qrJustUpdated = false;
            }, 900);
        };

        $scope.renew = function () {
            $scope.showQR = false;
            $scope.deviceId = $scope.formData.deviceIdNew;
            generateQrUrl();
            if ($scope.jsonData) {
                $scope.generateJson();
            }
            $scope.showQR = true;
        };

        $scope.groupsList = [];

        $scope.groupsSelection = ($scope.formData.groups || []).map(function (group) {
            return {id: group.id};
        });

        // This page is reachable without login (see app.js's $transitions.
        // onStart exemption for the 'qr' state) - groupService.getAllGroups
        // hits a private, auth-required endpoint, which 403s for an
        // anonymous visitor and (via the global 403 response interceptor in
        // app.js) force-redirects them to /login before they ever see the
        // QR code. Only fetch it when actually logged in; an anonymous
        // visitor still gets the full page, just with an empty "Add to
        // groups" list (the toggle/field itself is unaffected either way).
        if (authService.isLoggedIn()) {
            groupService.getAllGroups(function (response) {
                $scope.groups = response.data;
                $scope.groupsList = response.data.map(function (group) {
                    return {id: group.id, label: group.name};
                });
            });
        }

        $scope.groupsSelectionEvents = {
            onItemSelect: function(item) { $scope.renew(); $scope.flashQrUpdated(); },
            onItemDeselect: function(item) { $scope.renew(); $scope.flashQrUpdated(); },
            onSelectAll: function() { $scope.renew(); $scope.flashQrUpdated(); },
            onDeselectAll: function() { $scope.renew(); $scope.flashQrUpdated(); }
        };

        var urlPart = function() {
            var res = "";
            if ($scope.formData.deviceIdNew) {
                res += "&deviceId=" + $scope.formData.deviceIdNew;
            }
            if ($scope.formData.useId) {
                res += "&useId=" + $scope.formData.useId;
            }
            if ($scope.formData.create) {
                res += "&create=1";
                for (var i = 0; i < $scope.groupsSelection.length; i++) {
                    var group = $scope.groupsSelection[i];
                    res += "&group=" + encodeURI(group.id);
                }
            }
            return res;
        };

        var generateQrUrl = function() {
            $scope.qrCodeUrl = "rest/public/qr/" + $scope.qrCodeKey + "?size=" + $scope.size;
            $scope.qrDownloadUrl = "rest/public/qr/" + $scope.qrCodeKey + "?size=" + $scope.downloadSize;
            if ($scope.deviceId !== null) {
                $scope.qrCodeUrl += "&deviceId=" + $scope.deviceId;
                $scope.qrDownloadUrl += "&deviceId=" + $scope.deviceId;
            }
            $scope.qrCodeUrl += urlPart();
            $scope.qrDownloadUrl += urlPart();
        };
        $scope.renew();

        var slugify = function (value) {
            return (value || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
        };

        $scope.downloadFileName = function () {
            var configPart = slugify($scope.configName) || 'config';
            var devicePart = slugify($scope.deviceId) || 'new';
            return 'enroll-' + configPart + '-' + devicePart + '.png';
        };

        $scope.copyLink = function () {
            if (!navigator.clipboard) {
                return;
            }
            // navigator.clipboard.writeText() is a native Promise, not $q -
            // its .then() runs outside Angular's digest, so the toast must
            // be shown inside a $timeout to actually render (same pattern
            // as Files' copyPath() / the Configurations editor's copyQrUrl()).
            navigator.clipboard.writeText($window.location.href).then(function () {
                $timeout(function () {
                    alertService.success(localization.localize('form.configuration.settings.mdm.qrcode.copied'));
                });
            });
        };

        $scope.serverIsLocalhost = function () {
            var host = ($window.location.hostname || '').toLowerCase();
            return host === 'localhost' || host === '127.0.0.1';
        };

        $scope.generateJson = function() {
            var url = "rest/public/qr/json/" + $scope.qrCodeKey + "?" + urlPart().substring(1);
            $http.get(url)
                .then(function (response) {
                    if (response.status === 200) {
                        $scope.jsonData = response.data;
                    }
                });
        };

        $scope.tableFilteringTexts = {
            'buttonDefaultText': localization.localize('table.filtering.no.selected.group'),
            'checkAll': localization.localize('table.filtering.check.all'),
            'uncheckAll': localization.localize('table.filtering.uncheck.all'),
            'dynamicButtonTextSuffix': localization.localize('table.filtering.suffix.group')
        };

        $timeout(function () {
            hintService.onStateChangeSuccess();
        }, 300);
    });
