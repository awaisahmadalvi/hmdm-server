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
    // action, not a settings+CRUD-table page) can reuse it as-is. The
    // Reset/Save/unsaved-indicator group only renders when an on-save
    // attribute is actually supplied - the Logs settings page has no single
    // page-level save (retention and rules each save on their own), so it
    // uses this header with only the "Open plugin" link.
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
            templateUrl: 'app/shared/view/pluginSettingsHeader.html',
            link: function (scope, element, attrs) {
                scope.hasSaveActions = angular.isDefined(attrs.onSave);
            }
        };
    })
    // Reusable "purge old records" danger-zone card + confirmation dialog.
    // Built for the Messaging plugin settings page, then extracted here so
    // the Push plugin settings page (and any future one-time-purge plugin
    // settings page) can reuse it instead of duplicating the card/dialog
    // markup and validation/confirm/toast logic. Callers only provide:
    // - title/description: the card's own localized copy
    // - item-label: a localized noun ("messages", "push messages") spliced
    //   into the generic form.settings.purge.* strings
    // - days: two-way bound to the caller's own settings.xPurgePeriod
    // - purge-action: an expression calling the caller's own service, e.g.
    //   purge-action="doPurge(days, onSuccess, onError)" where doPurge just
    //   forwards to pluginXService.purgeOldMessages({days: days}, ...) -
    //   the directive never talks to a REST service directly
    // - note (optional): an extra informational line in the confirmation
    //   dialog, e.g. "Scheduled tasks are not affected."
    .directive('pluginPurgeCard', function () {
        return {
            restrict: 'E',
            scope: {
                title: '@',
                description: '@',
                itemLabel: '@',
                days: '=',
                note: '@',
                purgeAction: '&'
            },
            templateUrl: 'app/shared/view/pluginPurgeCard.html',
            controller: function ($scope, $modal, $timeout, localization) {
                $scope.periodInvalid = function () {
                    var v = $scope.days;
                    if (v === undefined || v === null || v === '') {
                        return true;
                    }
                    var num = Number(v);
                    return isNaN(num) || !Number.isInteger(num) || num < 1;
                };

                $scope.toast = null;
                var showToast = function (type, message) {
                    $scope.toast = { type: type, message: message };
                    $timeout(function () {
                        if ($scope.toast && $scope.toast.message === message) {
                            $scope.toast = null;
                        }
                    }, 3000);
                };

                $scope.openConfirm = function () {
                    if ($scope.periodInvalid()) {
                        return;
                    }

                    var days = $scope.days;
                    var cutoffDate = new Date(Date.now() - Number(days) * 86400000);

                    var modalInstance = $modal.open({
                        templateUrl: 'app/shared/view/pluginPurgeConfirm.modal.html',
                        controller: 'PluginPurgeConfirmController',
                        resolve: {
                            days: function () { return days; },
                            cutoffDate: function () { return cutoffDate; },
                            itemLabel: function () { return $scope.itemLabel; },
                            note: function () { return $scope.note; },
                            purgeAction: function () { return $scope.purgeAction; }
                        }
                    });

                    modalInstance.result.then(function (purged) {
                        if (purged) {
                            var item = $scope.itemLabel || '';
                            var capitalized = item.charAt(0).toUpperCase() + item.slice(1);
                            var message = localization.localize('form.settings.purge.success')
                                .replace('${item}', capitalized)
                                .replace('${days}', days);
                            showToast('success', message);
                        }
                    }, function (error) {
                        if (error) {
                            showToast('error', error);
                        }
                    });
                };
            }
        };
    })
    .controller('PluginPurgeConfirmController', function ($scope, $modalInstance, $filter,
                                                           localization, days, cutoffDate, itemLabel, note, purgeAction) {
        $scope.purging = false;
        $scope.errorMessage = undefined;
        $scope.note = note;

        var cutoffDateFormatted = $filter('date')(cutoffDate, localization.localize('format.date.purge.cutoff'));
        $scope.confirmTitle = localization.localize('form.settings.purge.confirm.title')
            .replace('${item}', itemLabel).replace('${days}', days);
        $scope.confirmBody = localization.localize('form.settings.purge.confirm.body')
            .replace('${item}', itemLabel).replace('${date}', cutoffDateFormatted);

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };

        $scope.confirmPurge = function () {
            $scope.errorMessage = undefined;
            $scope.purging = true;
            purgeAction({
                days: days,
                onSuccess: function (response) {
                    $scope.purging = false;
                    if (response.status === 'OK') {
                        $modalInstance.close(true);
                    } else {
                        $scope.errorMessage = localization.localizeServerResponse(response);
                    }
                },
                onError: function () {
                    $scope.purging = false;
                    $scope.errorMessage = localization.localize('error.request.failure');
                }
            });
        };
    })
    // Adds real drag-and-drop to an element that already carries the
    // (vendored, unmodified) uploadButton directive - that directive only
    // reacts to its own hidden <input type="file">'s native "change" event
    // (click-to-browse), it has no drop handling at all. On drop, this
    // finds that sibling input and feeds it the dropped file via the
    // standard DataTransfer/change-event trick so uploadButton's existing
    // on-upload/on-progress/on-success wiring fires completely unchanged -
    // this never talks to the upload REST endpoint itself. Reuses the same
    // "drag-over" class name as the plain dropZone directive above so the
    // existing .design-upload-zone.drag-over/.icons-empty-dropzone.drag-
    // over styles apply without any new CSS.
    .directive('dropUpload', function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var stop = function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                };

                element.on('dragover dragenter', function (event) {
                    stop(event);
                    element.addClass('drag-over');
                });

                element.on('dragleave', function (event) {
                    stop(event);
                    element.removeClass('drag-over');
                });

                element.on('drop', function (event) {
                    stop(event);
                    element.removeClass('drag-over');

                    var dataTransfer = (event.originalEvent || event).dataTransfer;
                    var files = dataTransfer && dataTransfer.files;
                    if (!files || files.length === 0) {
                        return;
                    }

                    var input = element[0].querySelector('input[type="file"]');
                    if (!input || typeof DataTransfer === 'undefined') {
                        return;
                    }

                    try {
                        var transfer = new DataTransfer();
                        transfer.items.add(files[0]);
                        input.files = transfer.files;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    } catch (e) {
                        // DataTransfer construction unsupported in this browser -
                        // the click-to-browse upload button still works fine.
                    }
                });
            }
        };
    });