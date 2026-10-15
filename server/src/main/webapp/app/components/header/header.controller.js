// Localization completed
angular.module( 'headwind-kiosk' )
.controller( 'HeaderController', function( $scope, $rootScope, $state, $modal, $timeout, $interval, $filter, $window, $document,
                                           authService, localization, hintService, rebranding, alertService, Idle ) {
    $scope.isControlPanel = false;
    $scope.authService = authService;
    $scope.showExitReportMode = false;
    $scope.$on( 'START_REPORT_MODE', function() {
        $scope.showExitReportMode = true;
    } );

    $scope.$on( 'HIDE_REPORT_MODE', function() {
        $scope.showExitReportMode = false;
    } );

    $scope.$on( 'HIDE_ADDRESS', function() {
        $scope.mapToolsConfig.showDeviceAddress = false;
    } );

    $scope.$on( 'SHOW_CHECKLIST_INFO', function( event, checklistId ) {
        showWorkResultsContent( checklistId );
    } );

    $scope.$on( 'SHOW_DATA_LOADING_MODAL', function() {
        $scope.dataLoadingWait = true;
    } );

    $scope.$on( 'HIDE_DATA_LOADING_MODAL', function() {
        $scope.dataLoadingWait = false;
    } );

    $scope.$on('IdleWarn', function(e, countdown) {
        if (!$scope.logoutAlert) {
            $scope.logoutAlert = alertService.showAlertMessage(
                localization.localize('idle.logout.message').replace('${sec}', countdown),
                function() {
                    $scope.logoutAlert = null;
                },
                localization.localize('idle.logout.resume'));
        } else {
            // How to update the logoutAlert contents??
        }
    });

    $scope.$on('IdleTimeout', function() {
        $scope.logoutAlert.close();
        $scope.logoutAlert = null;
        $scope.logout();
    });

    $rootScope.$on( 'SHOW_EXPIRY_WARNING', function() {
        $scope.expiryWarning = true;
    } );

    rebranding.query(function(value) {
        $scope.appName = value.appName;
    });

    updateDateTime = function() {
        $scope.dateTime = $filter( 'date' )( new Date(), localization.localize('format.date.header') );
    };
    updateDateTime();

    var interval = $interval( updateDateTime, 10000 );
    $scope.$on('$destroy', function() { $interval.cancel( interval ) } );

    $scope.getUserName = function() { return authService.getUserName(); };

    // Presentational-only: a user name past ~10 characters drops the
    // date/time below 1760px so the nav keeps its room (.header-long-
    // username in dashboard.css; the nav/brand-panel fit itself is measured
    // by the appHeaderFit directive). On $rootScope because the nav tabs
    // live in content.html, outside this controller's scope.
    $scope.$watch(function () {
        return (authService.getUserName() || '').length > 10;
    }, function (isLong) {
        $rootScope.headerLongUserName = isLong;
    });
    $scope.isAuth = function() { return authService.isLoggedIn() && document.URL.indexOf( 'invoice' ) === -1; };
    $scope.isHidden = function() {
        return $state.current.name === 'qr' || $state.current.name === 'passwordReset';
    };

    // Presentational-only: drives the CSS entry sweep on the header brand
    // badge (dashboard.css .brand-intro-play) on every full page load and
    // on login, never on in-app route changes. No auth/business logic
    // touched.
    $scope.playBrandIntro = false;
    var stopBrandIntro = function () {
        $scope.playBrandIntro = false;
    };
    // The class comes off when the sweep ends (animationend from the
    // badge's ::before bubbles up to the header). The $timeout is only a
    // fallback for when no animation runs at all - prefers-reduced-motion
    // skips it in CSS - and is long enough to cover header.html's
    // ng-include still loading on a cold page load.
    $document.on('animationend', function (event) {
        var original = event.originalEvent || event;
        if (original.animationName === 'header-badge-sweep' && $scope.playBrandIntro) {
            $scope.$apply(stopBrandIntro);
        }
    });
    // Fires on this watch's initial call when the page loads already
    // logged in (F5, Ctrl+R, a new tab - any full page load, on any
    // route), and again on a login (isAuth() false -> true). It never
    // fires on in-app navigation: HeaderController lives in main.html
    // outside <ui-view>, so it isn't re-created per route, and isAuth()
    // doesn't change between routes.
    $scope.$watch(function () { return $scope.isAuth(); }, function (isNowAuthed) {
        if (isNowAuthed) {
            $scope.playBrandIntro = true;
            $timeout(stopBrandIntro, 3000);
        }
    });

    $scope.isSuperAdmin = function() {
        return authService.isSuperAdmin();
    };
    $scope.updatesAllowed = function() {
        return (authService.isSingleCustomer() || authService.isSuperAdmin()) && authService.hasPermission('get_updates');
    };

    $scope.logout = function() {
        authService.logout();
        hintService.onLogout();
        $state.transitionTo( 'login' );
        $rootScope.$emit('aero_USER_LOGOUT');
    };

    $scope.isActive = function( state ) {
        return $state.$current.self.name === state;
    };

    $scope.controlPanel = function() {
        $state.transitionTo( 'control-panel' );
        $scope.isControlPanel = true;
    };

    $scope.mainPanel = function() {
        $state.transitionTo( 'main' );
        $scope.isControlPanel = false;
    };

    $scope.about = function () {
        $modal.open({
            templateUrl: 'app/components/about/about.html',
            controller: 'AboutController',
            windowClass: 'app-modal-narrow app-modal-about app-modal-fullscreen-mobile'
        }).result.catch(angular.noop); // closing (Close/Esc/backdrop) dismisses - not an error
    };
} );
