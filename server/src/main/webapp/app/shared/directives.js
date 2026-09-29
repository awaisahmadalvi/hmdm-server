// Localization completed
angular.module('headwind-kiosk')
    .directive('ngEnter', function () {
        return function (scope, element, attrs) {
            element.bind("keydown keypress", function (event) {
                if (event.which === 13) {
                    scope.$apply(function () {
                        scope.$eval(attrs.ngEnter);
                    });

                    event.preventDefault();
                }
            });
        };
    })
    .directive('dropZone', function () {
        // Purely presentational: adds a "drag-over" class while a file is
        // dragged over the element and invokes the given expression on
        // drop/click. Does not read or upload the dropped file itself -
        // callers wire drop to whatever their existing upload action is.
        return {
            restrict: 'A',
            scope: false,
            link: function (scope, element, attrs) {
                var stop = function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                };

                element.on('dragover dragenter', function (event) {
                    stop(event);
                    element.addClass('drag-over');
                });

                element.on('dragleave dragend', function (event) {
                    stop(event);
                    element.removeClass('drag-over');
                });

                element.on('drop', function (event) {
                    stop(event);
                    element.removeClass('drag-over');
                    scope.$apply(function () {
                        scope.$eval(attrs.dropZone);
                    });
                });
            }
        };
    })
    .directive('notificationMessage', function ($rootScope) {
        return {
            restrict: 'E',
            replace: false,
            transclude: true,
            template: "    <div class='notification-message' ng-show='message'>" +
                "        <div ng-show='message' class='success'><span>{{message}}</span></div>" +
                "    </div>",
            link: function (scope, elem, attrs) {

                var attrName = attrs.attrName;
                var message = $rootScope[attrName];

                if (message) {
                    scope.message = message;
                    $rootScope[attrName] = undefined;
                }

                var timer = setTimeout(function () {
                    scope.message = undefined;
                }, 5000);

                scope.$on('$destroy', function () {
                    clearTimeout(timer);
                });
            }
        }
    })
    .directive('fileInputDisabler', function () {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                if ('inputDisabled' in attrs) {
                    attrs.$observe('inputDisabled', function uploadButtonDisabledObserve(value) {
                        var fileInput = elem.find('input');
                        if (fileInput.length > 0) {
                            fileInput[0].disabled = scope.$eval(value);
                        }
                    });
                }
            }
        }
    })
    .directive( 'datepickerPopup', function (){
        return {
            restrict: 'EAC',
            require: 'ngModel',
            link: function( scope, element, attr, controller ) {
                controller.$formatters.shift();
            }
        }
    })
    .directive('focusMe', function ($timeout) {
        return {
            link: function (scope, element, attrs) {
                $timeout(function () {
                    element[0].focus();
                }, 200);
            }
        };
    })
    // Reusable header for a plugin's own settings page (breadcrumb back to
    // the Plugins list, icon + name + subtitle, an optional "Open plugin"
    // link to its Functions page, and the same Reset/Save/unsaved-changes
    // behavior used across the redesigned Settings pages). Built for the
    // Detailed Information plugin settings page; any other plugin settings
    // page that is a genuine load-then-save settings form (not a one-time
    // action, not a settings+CRUD-table page) can reuse it as-is.
    .directive('pluginSettingsHeader', function () {
        return {
            restrict: 'E',
            scope: {
                icon: '@',
                name: '@',
                subtitle: '@',
                breadcrumbLabel: '@',
                pluginState: '@',
                isDirty: '&',
                onReset: '&',
                onSave: '&',
                saving: '='
            },
            templateUrl: 'app/shared/view/pluginSettingsHeader.html'
        };
    });