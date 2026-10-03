// Localization completed
angular.module('headwind-kiosk')
    // Copies text to the clipboard, with a fallback for non-secure contexts
    // (plain http on an IP address, where navigator.clipboard doesn't
    // exist/isn't permitted) via a hidden textarea + document.execCommand
    // ('copy'). Shared by appCopyButton below and any one-off copy action
    // that doesn't go through that directive (e.g. Files' copyPath/
    // copyLink, the Configuration editor's copyQrUrl).
    .factory('clipboardService', function ($q, $document, $window) {
        return {
            copy: function (text) {
                text = (text === undefined || text === null) ? '' : String(text);
                var deferred = $q.defer();

                if ($window.navigator && $window.navigator.clipboard && $window.isSecureContext) {
                    $window.navigator.clipboard.writeText(text).then(function () {
                        deferred.resolve();
                    }, function (err) {
                        deferred.reject(err);
                    });
                    return deferred.promise;
                }

                try {
                    var body = $document[0].body;
                    var textarea = $document[0].createElement('textarea');
                    textarea.value = text;
                    textarea.setAttribute('readonly', '');
                    // Off-screen, not display:none - some browsers refuse to
                    // select()/copy from a non-rendered element.
                    textarea.style.position = 'fixed';
                    textarea.style.top = '-9999px';
                    textarea.style.left = '-9999px';
                    body.appendChild(textarea);

                    var selection = $document[0].getSelection();
                    var originalRange = (selection && selection.rangeCount > 0) ? selection.getRangeAt(0) : null;

                    textarea.focus();
                    textarea.select();
                    textarea.setSelectionRange(0, textarea.value.length);
                    var successful = $document[0].execCommand('copy');

                    body.removeChild(textarea);

                    // Restore whatever the user had selected on the page
                    // before this hijacked the selection to do the copy.
                    if (selection) {
                        selection.removeAllRanges();
                        if (originalRange) {
                            selection.addRange(originalRange);
                        }
                    }

                    if (successful) {
                        deferred.resolve();
                    } else {
                        deferred.reject(new Error('document.execCommand("copy") returned false'));
                    }
                } catch (e) {
                    deferred.reject(e);
                }
                return deferred.promise;
            }
        };
    })
    // Calls scope.$apply(fn), except when a digest is already running (e.g.
    // a click handler fired from inside a $q .then() callback - $q
    // resolves its callbacks as part of a digest, unlike a native
    // Promise), in which case $apply() would throw "[$rootScope:inprog]
    // $digest already in progress". Shared by appExpandableRow and
    // appCopyButton below, both of which attach their own native
    // element.on('click', ...) handlers (so, unlike ng-click, Angular
    // isn't already wrapping them in a digest-safe $apply for us) and can
    // be invoked either directly from a raw DOM event or from inside a
    // promise chain.
    .factory('safeApply', function () {
        return function (scope, fn) {
            var phase = scope.$root.$$phase;
            if (phase === '$apply' || phase === '$digest') {
                if (fn) {
                    fn();
                }
            } else {
                scope.$apply(fn);
            }
        };
    })
    // Shared "is this click actually meant to toggle the row, or did the
    // user just finish selecting/copying text (or click a link/button)
    // inside it?" check - used by appExpandableRow below, and available
    // directly for any expand/collapse handler that isn't a plain ng-click
    // on the row (e.g. one that also needs its own extra conditions).
    .factory('selectionGuard', function ($window) {
        // Only real interactive elements - NOT .app-code-block/.logs-
        // message-expanded themselves. Those used to be listed here too,
        // on the theory that a click "inside the expanded area" should be
        // left alone - but a copy-button click already stops its own
        // propagation (so that case never needed this list), and on a
        // page with no copy buttons at all (hide-copy="true", e.g. Push
        // messages) that blanket exclusion made the whole expanded block
        // permanently un-collapsible: every click inside it, buttonless or
        // not, matched .app-code-block and was ignored. A plain click with
        // no active selection should always be free to toggle.
        var INTERACTIVE_SELECTOR = 'a, button, .app-copy-btn';

        return {
            shouldIgnore: function (event) {
                var selection = $window.getSelection();
                if (selection && String(selection.toString()).length > 0) {
                    return true;
                }
                if (!event || !event.target || typeof event.target.closest !== 'function') {
                    return false;
                }
                return !!event.target.closest(INTERACTIVE_SELECTOR);
            }
        };
    })
    // Drop-in replacement for ng-click on a clickable/expandable table row:
    // <tr app-expandable-row="toggleExpand(row)">. Runs the given
    // expression exactly like ng-click would, except it does nothing (does
    // not toggle) when the click is actually the tail end of a text
    // selection, or when it bubbled up from a link/button/copyable code
    // block that should handle its own click. Without this, selecting text
    // in an expandable row's content collapses/re-renders the row on
    // mouseup and the selection is lost.
    .directive('appExpandableRow', function (selectionGuard, safeApply) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.on('click', function (event) {
                    if (selectionGuard.shouldIgnore(event)) {
                        return;
                    }
                    safeApply(scope, function () {
                        scope.$eval(attrs.appExpandableRow);
                    });
                });
            }
        };
    })
    // Shared copy-to-clipboard button: <button app-copy-button="expr"
    // app-copy-label="{{'button.copy' | localize}}" app-copy-toast="{{...}}">
    // - expr is evaluated (in the current scope, like ng-click) to get the
    // text to copy. Self-contained: stops the click from bubbling (so it
    // never triggers an ancestor's row-click/expand handler), flips its
    // icon to a checkmark for ~1.5s, and shows a success/error toast.
    // app-copy-label is optional - omit it for an icon-only button (the
    // collapsed-row hover affordance); pass it for a labeled button (the
    // expanded code block's "Copy"/"Copy formatted" buttons).
    .directive('appCopyButton', function (clipboardService, alertService, localization, $timeout, safeApply) {
        return {
            restrict: 'A',
            scope: {
                getText: '&appCopyButton',
                label: '@appCopyLabel',
                toastText: '@appCopyToast'
            },
            template:
                '<span class="glyphicon" ng-class="copied ? \'glyphicon-ok\' : \'glyphicon-copy\'" aria-hidden="true"></span>' +
                '<span class="app-copy-btn-label" ng-if="label">{{copied ? (\'common.copy.copied\' | localize) : label}}</span>',
            link: function (scope, element) {
                if (element[0].tagName === 'BUTTON' && !element.attr('type')) {
                    element.attr('type', 'button');
                }
                element.addClass('app-copy-btn');
                element.on('click', function (event) {
                    event.stopPropagation();
                    event.preventDefault();
                    var text = scope.getText();
                    if (text === undefined || text === null || text === '') {
                        return;
                    }
                    // clipboardService.copy()'s promise may settle either
                    // inside a digest (navigator.clipboard - a $q-wrapped
                    // native Promise resolves its .then() chain as part of
                    // one) or outside any digest (the execCommand fallback
                    // resolves synchronously, before Angular has started
                    // one for this click at all) - safeApply handles both.
                    clipboardService.copy(text).then(function () {
                        safeApply(scope, function () {
                            scope.copied = true;
                        });
                        $timeout(function () {
                            scope.copied = false;
                        }, 1500);
                        alertService.success(scope.toastText || localization.localize('common.copy.success'));
                    }, function () {
                        alertService.error(localization.localize('common.copy.error'));
                    });
                });
            }
        };
    })
    // Shared "copyable code" block: the expanded view of a payload/message/
    // JSON value, with a Copy (raw, exactly as stored) button and, only
    // when formatting actually changed something (i.e. the raw text was
    // valid JSON), a second Copy formatted button. One component instead of
    // every page re-building its own <pre> + buttons - used by the Logs
    // and Audit pages' expanded rows, and (with hide-copy, see below) the
    // Push messages page.
    //   <div app-code-block raw-text="message.payload"
    //        formatted-text="formatPayload(message.payload)"
    //        copy-toast="{{'form.plugin.push.payload.copied' | localize}}"></div>
    // hide-copy="true" removes the actions row entirely (not just hides it)
    // for a page where copying is meant to happen by manually selecting the
    // text instead (the Push messages page, after selecting text there
    // turned out to fight the row's click-to-collapse handling the same
    // way a copy button's own click could) - cheaper than a second
    // component for the one page that doesn't want the buttons.
    .directive('appCodeBlock', function (localization) {
        return {
            restrict: 'A',
            scope: {
                rawText: '<',
                formattedText: '<',
                copyToast: '@',
                hideCopy: '<'
            },
            template:
                '<div class="app-code-block" ng-class="{\'app-code-block-no-actions\': hideCopy}">' +
                    '<div class="app-code-block-actions" ng-if="!hideCopy">' +
                        '<button app-copy-button="rawText" app-copy-label="{{copyRawLabel}}" app-copy-toast="{{copyToast}}"></button>' +
                        '<button ng-if="showFormatted" app-copy-button="formattedText" app-copy-label="{{copyFormattedLabel}}" app-copy-toast="{{copyToast}}"></button>' +
                    '</div>' +
                    '<pre class="logs-message-expanded app-code-block-pre">{{formattedText}}</pre>' +
                '</div>',
            link: function (scope) {
                scope.copyRawLabel = localization.localize('button.copy');
                scope.copyFormattedLabel = localization.localize('common.copy.formatted');
                scope.showFormatted = scope.rawText !== scope.formattedText;
            }
        };
    })
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
        // $event is exposed as a local (the native drop event, so callers
        // that need the dropped File can read $event.dataTransfer.files) -
        // existing usages don't reference $event in their expression, so
        // this is a backward-compatible addition.
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
                        scope.$eval(attrs.dropZone, {$event: (event.originalEvent || event)});
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
    })
    // Shared row/card "..." actions menu, replacing ui-bootstrap's
    // uib-dropdown for this one use case across the redesigned pages
    // (Configurations, Roles, Groups, Users, Files, the Logs plugin's
    // rules table).
    //
    // Root cause of the bug this replaces: every .device-details-card
    // (and .summary-kpi-card) plays a one-time intro animation
    // (animation: summary-card-in ... both) whose final keyframe sets
    // transform: translateY(0). Because of the "both" fill mode, that
    // (visually inert, identity) transform value stays applied forever
    // after the animation ends - and per spec, ANY non-"none" transform
    // value, even an identity one, makes the element a new stacking
    // context and a new containing block for position:fixed/absolute
    // descendants. So every card became its own stacking context; a
    // uib-dropdown menu positioned absolutely inside one card can never
    // out-rank a *later* card in the same grid, no matter its z-index,
    // because that z-index only wins comparisons *inside* its own card's
    // context - the next card's whole context simply paints on top of it.
    // (Separately, table-based rows do not have this transform, but their
    // .modern-table-wrap sets overflow-x: auto, which per spec forces the
    // paired overflow-y: visible to compute as auto too, so a uib-dropdown
    // menu opened on a row near the bottom of the table can get clipped by
    // that box exactly like a native <select> would.)
    //
    // Fix: don't fight either ancestor's containing-block/overflow rules -
    // detach the <ul class="dropdown-menu actions-menu-list"> and
    // re-parent it onto <body> while open, then position it with
    // position: fixed from the trigger button's own getBoundingClientRect,
    // right-aligned to the trigger and flipped upward when there isn't
    // room below. document.body has no transform/filter/overflow of its
    // own, so the menu is never clipped or out-stacked by ANY ancestor
    // again, regardless of what that ancestor's CSS does today or later.
    //
    // Markup contract (see any of the pages above): a wrapper carrying
    // this attribute, with exactly one <button> (the trigger) and one
    // <ul class="dropdown-menu actions-menu-list"> (the menu) as children.
    .factory('actionsMenuRegistry', function () {
        var closeCurrent = null;
        return {
            open: function (closeFn) {
                if (closeCurrent && closeCurrent !== closeFn) {
                    closeCurrent();
                }
                closeCurrent = closeFn;
            },
            close: function (closeFn) {
                if (closeCurrent === closeFn) {
                    closeCurrent = null;
                }
            }
        };
    })
    // Renders one Lucide icon (ISC license) from the sprite inlined in
    // index.html (images/icons/lucide/sprite.svg is the source it was
    // generated from - regenerate both together if icons are added or
    // removed). <app-lucide-icon name="shield-check" size="18"></app-
    // lucide-icon> - size defaults to 18 (px) if omitted. Named
    // appLucideIcon, not appIcon, specifically so it can't collide with
    // the existing appIcon directive just below (a completely different
    // component - an application's package icon/avatar) now that both
    // exist in the same module: two restrict:'E' directives matching the
    // same element name, each wanting their own isolate scope, would
    // throw "Multiple directives asking for new/isolated scope".
    // Deliberately dumb/presentational - no fetching, no state, just a
    // thin wrapper around <svg><use></svg> - so every consumer controls
    // color via CSS currentColor and this directive never needs touching
    // again when a new icon is added to the sprite.
    .directive('appLucideIcon', function ($log) {
        // Shared across every <app-lucide-icon> instance (not per-element) -
        // a column rendered for 50 devices on the same bad icon name should
        // warn once, not 50 times.
        var warnedNames = {};

        return {
            restrict: 'E',
            scope: {
                name: '@',
                size: '@'
            },
            template:
                '<svg class="app-lucide-icon" ng-style="{width: (size || 18) + \'px\', height: (size || 18) + \'px\'}" aria-hidden="true" focusable="false">' +
                    '<use ng-attr-href="{{\'#icon-\' + name}}"></use>' +
                '</svg>',
            link: function (scope) {
                // Fails loud instead of silently rendering nothing (or, worse,
                // something that LOOKS like it rendered but didn't - this is
                // exactly how the Devices table's "more" button issue went
                // unnoticed: a <use href="#icon-x"> against a symbol id that
                // doesn't exist in the sprite is valid SVG, so the browser
                // just shows an empty box, no error anywhere).
                scope.$watch('name', function (name) {
                    if (!name || warnedNames[name]) {
                        return;
                    }
                    if (!document.getElementById('icon-' + name)) {
                        warnedNames[name] = true;
                        $log.warn('[app-lucide-icon] Unknown icon name "' + name + '" - no #icon-' + name +
                            ' symbol in the sprite (images/icons/lucide/sprite.svg / index.html). Rendering empty.');
                    }
                });
            }
        };
    })
    // Renders an application's icon, replacing the old plain grey
    // .app-icon-placeholder square. Priority order: (1) the assigned
    // Settings -> Icons image if one is set (application.iconId, resolved
    // via appIconService, main.service.js); (2) the icon auto-extracted
    // from the APK on upload, if one was stored (application.apkIconFileId -
    // a direct uploadedFiles reference, resolved via the same service's
    // getFileUrlMap, no icons-table indirection); (3) a type icon (globe
    // for web pages, gear for system actions) or the app's initials,
    // always on a stable color pulled from a fixed 8-color palette hashed
    // from the app's package ID (or name/id as a fallback key) so the same
    // app always gets the same color. A broken/expired image URL falls
    // back to the same avatar via the native <img> "error" event. Used in
    // the Applications table, the Add/Edit dialog (header and launcher
    // preview) and the Configuration editor's Applications tab.
    .directive('appIcon', function (appIconService) {
        var PALETTE_SIZE = 8;

        var colorIndex = function (key) {
            var str = key || '';
            var hash = 0;
            for (var i = 0; i < str.length; i++) {
                hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
            }
            return hash % PALETTE_SIZE;
        };

        // Trailing words too generic to make a name's initials distinctive
        // (e.g. "Headwind MDM Pager Plugin" and "Headwind MDM update helper"
        // both ended up as "HM" when this just took the first two words).
        var GENERIC_TRAILING_WORDS = [
            'helper', 'plugin', 'utility', 'util', 'service', 'app', 'tool',
            'module', 'extension', 'addon', 'component', 'agent', 'client',
            'manager', 'assistant', 'driver', 'daemon'
        ];

        var firstLetterOf = function (word) {
            var match = (word || '').match(/[A-Za-z]/);
            return match ? match[0] : (word ? word.charAt(0) : '?');
        };

        var initialsOf = function (application) {
            var name = ((application && (application.name || application.pkg)) || '?').trim();
            if (!name) {
                return '?';
            }
            var words = name.split(/\s+/).filter(Boolean);
            if (words.length <= 1) {
                return name.substring(0, 2).toUpperCase();
            }
            // First word's initial + the last word that isn't a generic
            // suffix (falling back to the actual last word if every word
            // after the first one happens to be generic) - two apps that
            // only differ by a trailing "Plugin"/"helper" no longer collapse
            // to the same two letters.
            var lastDistinctiveWord = words[words.length - 1];
            for (var i = words.length - 1; i >= 1; i--) {
                var bareWord = words[i].replace(/[^A-Za-z]/g, '');
                if (bareWord && GENERIC_TRAILING_WORDS.indexOf(bareWord.toLowerCase()) === -1) {
                    lastDistinctiveWord = words[i];
                    break;
                }
            }
            return (firstLetterOf(words[0]) + firstLetterOf(lastDistinctiveWord)).toUpperCase();
        };

        return {
            restrict: 'E',
            scope: {
                application: '=',
                size: '@'
            },
            template:
                '<span class="app-icon-tile" ng-class="avatarColorClass" ng-style="tileStyle">' +
                    '<img ng-show="iconUrl && !imgBroken" ng-src="{{iconUrl}}" class="app-icon-tile-img" alt="" />' +
                    '<span ng-show="!iconUrl || imgBroken" class="app-icon-tile-fallback">' +
                        '<span ng-if="application.type === \'web\'" class="glyphicon glyphicon-globe"></span>' +
                        '<span ng-if="application.type === \'intent\'" class="glyphicon glyphicon-cog"></span>' +
                        '<span ng-if="application.type !== \'web\' && application.type !== \'intent\'">{{initials}}</span>' +
                    '</span>' +
                '</span>',
            link: function (scope, element) {
                var px = parseInt(scope.size, 10) || 36;
                scope.tileStyle = {
                    width: px + 'px',
                    height: px + 'px',
                    'font-size': Math.max(10, Math.round(px * 0.38)) + 'px'
                };

                element.find('img').on('error', function () {
                    scope.$apply(function () {
                        scope.imgBroken = true;
                    });
                });

                var refresh = function () {
                    var application = scope.application || {};
                    scope.imgBroken = false;
                    scope.iconUrl = null;
                    scope.initials = initialsOf(application);
                    var key = application.pkg || application.name || String(application.id || '');
                    scope.avatarColorClass = 'app-icon-color-' + colorIndex(key);

                    var iconId = application.iconId;
                    var apkIconFileId = application.apkIconFileId;
                    if (iconId && iconId !== -1) {
                        // 1. An explicitly assigned Settings -> Icons image always wins.
                        appIconService.getMap(function (map) {
                            if (scope.application === application && application.iconId === iconId) {
                                scope.iconUrl = map[iconId] || null;
                            }
                        });
                    } else if (apkIconFileId) {
                        // 2. Otherwise, the icon auto-extracted from the APK, if one was stored.
                        appIconService.getFileUrlMap(function (fileUrlById) {
                            if (scope.application === application && application.apkIconFileId === apkIconFileId) {
                                scope.iconUrl = fileUrlById[apkIconFileId] || null;
                            }
                        });
                    }
                    // 3. Otherwise the fallback avatar (initials/type glyph) computed above is all that renders.
                };

                scope.$watch('application.iconId', refresh);
                scope.$watch('application.apkIconFileId', refresh);
                scope.$watch('application.name', refresh);
                scope.$watch('application.pkg', refresh);
                scope.$watch('application.type', refresh);
            }
        };
    })
    .directive('appActionsMenu', function ($document, $window, actionsMenuRegistry) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var toggleBtn = element[0].querySelector('button');
                var menu = element[0].querySelector('.dropdown-menu');
                if (!toggleBtn || !menu) {
                    return;
                }

                var menuEl = angular.element(menu);
                var originalParent = menu.parentNode;
                var originalNextSibling = menu.nextSibling;
                var open = false;

                var positionMenu = function () {
                    var rect = toggleBtn.getBoundingClientRect();
                    var viewportHeight = $window.innerHeight;
                    var viewportWidth = $window.innerWidth;

                    // left: 'auto' is required here, not optional - Bootstrap's base
                    // .dropdown-menu class sets left: 0, and a fixed-position box with
                    // both left and right set to real values doesn't shrink-to-fit, it
                    // stretches to span between them (full viewport width here). The
                    // markup should also carry .dropdown-menu-right for this same
                    // reason, but this directive no longer depends on that convention
                    // being remembered correctly.
                    menuEl.css({ top: 'auto', bottom: 'auto', left: 'auto', right: (viewportWidth - rect.right) + 'px' });

                    var menuHeight = menu.offsetHeight;
                    var spaceBelow = viewportHeight - rect.bottom;
                    if (spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8) {
                        menuEl.css({ bottom: (viewportHeight - rect.top + 4) + 'px', top: 'auto' });
                    } else {
                        menuEl.css({ top: (rect.bottom + 4) + 'px', bottom: 'auto' });
                    }
                };

                var onDocumentClick = function (event) {
                    if (menu.contains(event.target) || toggleBtn.contains(event.target)) {
                        return;
                    }
                    scope.$apply(closeMenu);
                };

                var onKeydown = function (event) {
                    if (event.key === 'Escape' || event.keyCode === 27) {
                        scope.$apply(closeMenu);
                    }
                };

                var onItemClick = function (event) {
                    if (event.target.tagName === 'A') {
                        scope.$apply(closeMenu);
                    }
                };

                function closeMenu() {
                    if (!open) {
                        return;
                    }
                    open = false;
                    element.removeClass('open');
                    menuEl.removeClass('actions-menu-list-open');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    $document.off('click', onDocumentClick);
                    $document.off('keydown', onKeydown);
                    document.removeEventListener('scroll', closeMenu, true);
                    angular.element($window).off('resize', positionMenu);
                    actionsMenuRegistry.close(closeMenu);

                    if (menu.parentNode === document.body) {
                        if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
                            originalParent.insertBefore(menu, originalNextSibling);
                        } else {
                            originalParent.appendChild(menu);
                        }
                    }
                }

                var openMenu = function () {
                    actionsMenuRegistry.open(closeMenu);
                    document.body.appendChild(menu);
                    menuEl.addClass('actions-menu-list-open');
                    element.addClass('open');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                    open = true;
                    positionMenu();

                    $document.on('click', onDocumentClick);
                    $document.on('keydown', onKeydown);
                    // capture: true - scroll events don't bubble, this is the
                    // only way to hear a scroll on a nested container too
                    // (e.g. .modern-table-wrap's horizontal scrollbar).
                    document.addEventListener('scroll', closeMenu, true);
                    angular.element($window).on('resize', positionMenu);
                };

                angular.element(toggleBtn).on('click', function (event) {
                    event.stopPropagation();
                    scope.$apply(open ? closeMenu : openMenu);
                });

                menuEl.on('click', onItemClick);

                scope.$on('$destroy', function () {
                    closeMenu();
                    if (menu.parentNode) {
                        menu.parentNode.removeChild(menu);
                    }
                });
            }
        };
    })
    // Hover/focus tooltip rendered as a single shared node appended to
    // <body> (a "portal", same technique as appActionsMenu above), instead
    // of the obvious CSS ::after-on-the-element approach. That CSS-only
    // version is what the Devices table's icon column headers originally
    // used, and it broke in two ways once a header could be scrolled
    // inside .modern-table-wrap's overflow-x:auto: the tooltip is
    // position:absolute relative to the header, so (a) it's clipped
    // whenever it would render past the wrap's own edge (confirmed live -
    // overflow-y on that wrap computes to "auto", not the "visible" the
    // page's CSS asks for, because a non-visible overflow-x forces that per
    // spec), and (b) a header near the left/right edge of the current
    // scroll position pushes a centered tooltip partway outside the wrap,
    // where it gets cut off rather than reflowing. Anchoring from
    // getBoundingClientRect() and rendering with position:fixed on <body>
    // sidesteps both - the tooltip is never a descendant of the scrolling
    // element, so nothing can clip it, and it always reflects the header's
    // actual current on-screen position whether or not the table is
    // scrolled.
    //   <th app-header-tooltip="{{'Full column name' + ' - click to sort'}}"
    //       aria-label="{{'Full column name'}}" tabindex="0">
    // aria-label is separate and always just the plain column name - this
    // directive only controls the visual tooltip, not what a screen reader
    // announces.
    .directive('appHeaderTooltip', function ($document, $window) {
        var SHOW_DELAY = 150;
        var VIEWPORT_MARGIN = 6;
        var GAP = 8;

        var tooltipEl = null;
        var showTimer = null;
        var activeElement = null;

        function ensureTooltipEl() {
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'app-header-tooltip';
                tooltipEl.setAttribute('role', 'tooltip');
                document.body.appendChild(tooltipEl);
            }
            return tooltipEl;
        }

        function hide() {
            if (showTimer) {
                clearTimeout(showTimer);
                showTimer = null;
            }
            activeElement = null;
            if (tooltipEl) {
                tooltipEl.classList.remove('app-header-tooltip-visible');
            }
        }

        // Positioned above the anchor by default, flipped below when there
        // isn't room above; clamped horizontally so it never renders
        // partway off either edge of the viewport.
        function show(el, text) {
            if (!text) {
                return;
            }
            var tip = ensureTooltipEl();
            tip.textContent = text;
            tip.classList.remove('app-header-tooltip-flipped');
            tip.classList.add('app-header-tooltip-visible');

            var rect = el.getBoundingClientRect();
            var tipRect = tip.getBoundingClientRect();
            var viewportWidth = $window.innerWidth;
            var viewportHeight = $window.innerHeight;

            var left = rect.left + (rect.width / 2) - (tipRect.width / 2);
            left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - tipRect.width - VIEWPORT_MARGIN));

            var top = rect.top - tipRect.height - GAP;
            if (top < VIEWPORT_MARGIN) {
                top = rect.bottom + GAP;
                tip.classList.add('app-header-tooltip-flipped');
            }
            if (top + tipRect.height > viewportHeight - VIEWPORT_MARGIN) {
                // Neither side fits (a very short viewport) - keep it on
                // screen rather than let it run off the bottom.
                top = Math.max(VIEWPORT_MARGIN, viewportHeight - tipRect.height - VIEWPORT_MARGIN);
            }

            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        }

        var onScrollOrResize = function () {
            // Deliberately just hides rather than repositions - once the
            // user scrolls, the delay before a tooltip would reappear on
            // the same header (another hover/focus) is cheap insurance
            // against it drifting away from the icon mid-scroll.
            hide();
        };
        document.addEventListener('scroll', onScrollOrResize, true);
        angular.element($window).on('resize', onScrollOrResize);

        return {
            restrict: 'A',
            scope: false,
            link: function (scope, element, attrs) {
                var text = attrs.appHeaderTooltip || '';
                attrs.$observe('appHeaderTooltip', function (value) {
                    text = value;
                });

                var scheduleShow = function () {
                    activeElement = element[0];
                    if (showTimer) {
                        clearTimeout(showTimer);
                    }
                    showTimer = setTimeout(function () {
                        if (activeElement === element[0]) {
                            show(element[0], text);
                        }
                    }, SHOW_DELAY);
                };

                element.on('mouseenter focus', scheduleShow);
                element.on('mouseleave blur', hide);

                scope.$on('$destroy', function () {
                    element.off('mouseenter focus', scheduleShow);
                    element.off('mouseleave blur', hide);
                    if (activeElement === element[0]) {
                        hide();
                    }
                });
            }
        };
    })
    // Toggles 'app-scrolled-left'/'app-scrolled-right' classes on a
    // horizontally-scrolling container based on its actual scrollLeft, so
    // CSS can show the sticky-column edge shadow (app/css/dashboard.css,
    // the Devices table's sticky checkbox/Status/Device number/Actions
    // columns) only while there's really more content scrolled underneath
    // it, instead of a constant shadow that's misleading at the scroll
    // extremes. <div class="modern-table-wrap" app-scroll-edge-shadow>
    .directive('appScrollEdgeShadow', function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var el = element[0];

                function update() {
                    var maxScroll = el.scrollWidth - el.clientWidth;
                    var atStart = el.scrollLeft <= 1;
                    var atEnd = el.scrollLeft >= maxScroll - 1;
                    element.toggleClass('app-scrolled-left', !atStart && maxScroll > 1);
                    element.toggleClass('app-scrolled-right', !atEnd && maxScroll > 1);
                }

                element.on('scroll', update);
                // Column visibility/density changes (and the initial render)
                // can change scrollWidth without a scroll event ever firing -
                // re-check shortly after link so the shadow starts correct.
                setTimeout(update, 0);

                scope.$on('$destroy', function () {
                    element.off('scroll', update);
                });
            }
        };
    });