// Localization completed

// Doughnut center-total plugin: modern dashboards show the total inside the
// ring instead of a blank hole. Opt-in per chart via options.elements.center
// (only the summary page's doughnuts set it) - registered once, globally,
// since Chart.js has no per-directive plugin scoping and this file always
// loads after chart.js/angular-chart.js (see index.html script order).
if (typeof Chart !== 'undefined' && Chart.pluginService && !Chart.pluginService.getAll().some(function (p) { return p.id === 'summaryCenterText'; })) {
    Chart.pluginService.register({
        id: 'summaryCenterText',
        beforeDraw: function (chart) {
            var center = chart.config.options.elements && chart.config.options.elements.center;
            if (!center || !center.text) {
                return;
            }
            var ctx = chart.chart.ctx;
            var width = chart.chart.width;
            var height = chart.chart.height;
            ctx.save();
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.font = '700 ' + Math.round(height * 0.16) + 'px "Helvetica Neue", Arial, sans-serif';
            ctx.fillStyle = center.color || '#0f172a';
            ctx.fillText(center.text, width / 2, height / 2);
            ctx.restore();
        }
    });
}

angular.module('headwind-kiosk')
    .controller('SummaryTabController', function ($scope, localization, summaryService, groupService, configurationService, deviceService) {
        $scope.stat = undefined;
        $scope.errorMessage = undefined;

        // Modern flat palette, tied to the app's own brand-dark (--brand-dark)
        // theme instead of the old muddy defaults (#DCDCDC/#97BBCD/...).
        var palette = {
            navy: '#0f172a',
            slate: '#cbd5e1',
            slateText: '#94a3b8',
            emerald: '#10b981',
            amber: '#f59e0b',
            rose: '#f43f5e',
            sky: '#38bdf8',
            track: '#e2e8f0'
        };

        $scope.enrollmentLabels = [
            localization.localize('summary.devices.enrolled.earlier'),
            localization.localize('summary.devices.enrolled.monthly')
        ];
        $scope.enrollmentColors = [
            palette.slate,
            palette.navy
        ];

        $scope.statusLabels = [
            localization.localize('summary.devices.offline'),
            localization.localize('summary.devices.idle'),
            localization.localize('summary.devices.active')
        ];
        $scope.statusColors = [
            palette.rose,
            palette.amber,
            palette.emerald
        ];

        $scope.installLabels = [
            localization.localize('summary.devices.installation.failed'),
            localization.localize('summary.devices.version.mismatch'),
            localization.localize('summary.devices.installation.completed')
        ];
        $scope.installColors = $scope.statusColors;

        $scope.statusByConfigSeries = [
            localization.localize('summary.devices.offline'),
            localization.localize('summary.devices.idle'),
            localization.localize('summary.devices.active')
        ];
        $scope.statusByConfigColors = [
            palette.rose, palette.amber, palette.emerald
        ];

        $scope.installByConfigSeries = [
            localization.localize('summary.devices.installation.failed'),
            localization.localize('summary.devices.version.mismatch'),
            localization.localize('summary.devices.installation.completed')
        ];
        $scope.installByConfigColors = $scope.statusByConfigColors;

        // Shared Chart.js v2 option sets (passed via chart-options="..." in
        // summary.html) - smoother animation, flat modern tooltips, and
        // gridlines toned down instead of Chart.js's harsh grey defaults.
        $scope.doughnutOptions = {
            cutoutPercentage: 72,
            legend: { display: false },
            animation: { animateScale: true, duration: 900, easing: 'easeOutQuart' },
            tooltips: {
                backgroundColor: palette.navy,
                titleFontColor: '#fff',
                bodyFontColor: '#fff',
                cornerRadius: 8,
                displayColors: false,
                padding: 10
            }
        };

        $scope.barOptionsSimple = {
            legend: { display: false },
            animation: { duration: 900, easing: 'easeOutQuart' },
            tooltips: {
                backgroundColor: palette.navy,
                cornerRadius: 8,
                displayColors: false,
                padding: 10
            },
            scales: {
                xAxes: [{
                    gridLines: { display: false },
                    ticks: { fontColor: palette.slateText }
                }],
                yAxes: [{
                    gridLines: { color: '#e2e8f0', drawBorder: false, zeroLineColor: '#e2e8f0' },
                    ticks: { fontColor: palette.slateText, beginAtZero: true, precision: 0 }
                }]
            }
        };

        $scope.barOptionsLegend = angular.extend({}, $scope.barOptionsSimple, {
            legend: {
                display: true,
                position: 'bottom',
                labels: { boxWidth: 10, fontColor: palette.slateText }
            }
        });

        // Smooth gradient-filled area chart (design.png's "Live Feeds" style)
        // for monthly enrollment, in place of the old flat bar chart - same
        // axis/tooltip treatment as barOptionsSimple, plus a bezier curve and
        // hidden points (dots only appear on hover) instead of straight
        // bar-to-bar segments.
        $scope.lineOptions = angular.merge({}, $scope.barOptionsSimple, {
            maintainAspectRatio: false,
            elements: {
                line: { tension: 0.4, borderWidth: 2, fill: true },
                point: { radius: 0, hoverRadius: 5, hitRadius: 10 }
            }
        });

        // Single flat fill/line color for the area chart - passed via
        // chart-dataset-override instead of chart-colors, because
        // angular-chart's default single-series color handling assigns one
        // color PER DATA POINT (meant for bar charts), which Chart.js's line
        // controller can't use as a fill color. This bypasses that entirely.
        $scope.monthlyEnrollDatasetOverride = {
            backgroundColor: 'rgba(15, 23, 42, 0.18)',
            hoverBackgroundColor: 'rgba(15, 23, 42, 0.18)',
            borderColor: palette.navy,
            pointBackgroundColor: palette.navy,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: palette.navy,
            fill: true,
            lineTension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5
        };

        // Circular "rate" gauges (design.png's Server-load/Disk-space style
        // widgets, minus the fabricated sparkline trend - there's no real
        // historical data behind these percentages to plot a trend from).
        // Each gauge is a 2-slice doughnut: [value%, 100-value%], with the
        // remainder always the same neutral track color.
        $scope.gaugeOptions = {
            cutoutPercentage: 80,
            legend: { display: false },
            tooltips: { enabled: false },
            animation: { animateScale: true, duration: 900, easing: 'easeOutQuart' }
        };

        $scope.activeRateColors = [palette.emerald, palette.track];
        $scope.offlineRateColors = [palette.rose, palette.track];
        $scope.enrollRateColors = [palette.sky, palette.track];
        $scope.installRateColors = [palette.navy, palette.track];

        function pct(numerator, denominator) {
            if (!denominator) {
                return 0;
            }
            return Math.round((numerator / denominator) * 100);
        }

        function withCenterText(totalText) {
            return angular.merge({}, $scope.doughnutOptions, {
                elements: { center: { text: totalText, color: palette.navy } }
            });
        }

        function withGaugeCenter(percent, color) {
            return angular.merge({}, $scope.gaugeOptions, {
                elements: { center: { text: percent + '%', color: color } }
            });
        }

        // KPI hero cards at the top of the page - values are read live off the
        // same enrollmentData/statusData arrays the charts/legends below use,
        // via closures, so they update together once summaryService resolves.
        $scope.kpiCards = [
            {
                icon: 'glyphicon-phone',
                color: palette.navy,
                bg: '#e2e8f0',
                labelKey: 'summary.devices.enrolled.total',
                value: function () { return $scope.enrollmentData ? ($scope.enrollmentData[0] + $scope.enrollmentData[1]) : 0; }
            },
            {
                icon: 'glyphicon-ok-circle',
                color: palette.emerald,
                bg: '#d1fae5',
                labelKey: 'summary.devices.active',
                value: function () { return $scope.statusData ? $scope.statusData[2] : 0; }
            },
            {
                icon: 'glyphicon-time',
                color: palette.amber,
                bg: '#fef3c7',
                labelKey: 'summary.devices.idle',
                value: function () { return $scope.statusData ? $scope.statusData[1] : 0; }
            },
            {
                icon: 'glyphicon-off',
                color: palette.rose,
                bg: '#ffe4e6',
                labelKey: 'summary.devices.offline',
                value: function () { return $scope.statusData ? $scope.statusData[0] : 0; }
            }
        ];

        // Group/Configuration filter above the charts. There is no
        // server-side "summary by group" or "filtered summary" endpoint
        // (/rest/private/summary/devices takes no params at all), so this
        // is implemented entirely client-side: fetch the matching devices
        // via the same rest/private/devices/search endpoint the Devices
        // page uses (it already supports groupId/configurationId) and
        // recompute the Enrollment/Device-status numbers from that list.
        // The Application-status card and the "by configuration" bars stay
        // on the unfiltered, server-aggregated numbers always - per-device
        // app install status isn't part of the device list response, so
        // there's no cheap way to filter that dimension without a new
        // backend endpoint.
        $scope.selection = { groupId: -1, configurationId: -1 };
        $scope.filterActive = false;
        $scope.filterLoading = false;

        groupService.getAllGroups(function (response) {
            $scope.groups = response.data;
            $scope.groups.unshift({ id: -1, name: localization.localize('devices.group.options.all') });
        });

        configurationService.getAllConfigNames(function (response) {
            $scope.configurations = response.data;
            $scope.configurations.unshift({ id: -1, name: localization.localize('devices.configuration.options.all') });
        });

        function monthBuckets() {
            var now = new Date();
            var keys = [];
            var labels = [];
            for (var m = 11; m >= 0; m--) {
                var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
                keys.push(d.getFullYear() + '-' + d.getMonth());
                labels.push((d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2));
            }
            return { keys: keys, labels: labels, counts: labels.map(function () { return 0; }) };
        }

        function computeFromDevices(devices) {
            var now = Date.now();
            var thirtyDaysAgo = now - 30 * 86400 * 1000;
            var buckets = monthBuckets();
            var statusCounts = { red: 0, yellow: 0, green: 0 };
            var enrolledTotal = 0;
            var enrolledLastMonth = 0;

            devices.forEach(function (device) {
                if (statusCounts.hasOwnProperty(device.statusCode)) {
                    statusCounts[device.statusCode]++;
                }
                if (device.enrollTime > 0) {
                    enrolledTotal++;
                    if (device.enrollTime >= thirtyDaysAgo) {
                        enrolledLastMonth++;
                    }
                    var ed = new Date(device.enrollTime);
                    var idx = buckets.keys.indexOf(ed.getFullYear() + '-' + ed.getMonth());
                    if (idx >= 0) {
                        buckets.counts[idx]++;
                    }
                }
            });

            var earlier = enrolledTotal - enrolledLastMonth;
            if (earlier < 0) {
                earlier = 0;
            }

            return {
                enrollmentData: [earlier, enrolledLastMonth],
                statusData: [statusCounts.red, statusCounts.yellow, statusCounts.green],
                monthlyEnrollLabels: buckets.labels,
                monthlyEnrollData: buckets.counts
            };
        }

        function applyView(view) {
            $scope.enrollmentData = view.enrollmentData;
            $scope.statusData = view.statusData;
            $scope.monthlyEnrollLabels = view.monthlyEnrollLabels;
            $scope.monthlyEnrollData = view.monthlyEnrollData;
            $scope.enrollmentOptions = withCenterText(String(view.enrollmentData[0] + view.enrollmentData[1]));
            $scope.statusOptions = withCenterText(String(view.statusData[0] + view.statusData[1] + view.statusData[2]));

            var statusTotal = view.statusData[0] + view.statusData[1] + view.statusData[2];
            var activePct = pct(view.statusData[2], statusTotal);
            var offlinePct = pct(view.statusData[0], statusTotal);
            $scope.activeRateData = [activePct, 100 - activePct];
            $scope.activeRateOptions = withGaugeCenter(activePct, palette.emerald);
            $scope.offlineRateData = [offlinePct, 100 - offlinePct];
            $scope.offlineRateOptions = withGaugeCenter(offlinePct, palette.rose);

            var enrollTotal = view.enrollmentData[0] + view.enrollmentData[1];
            var enrollPct = pct(view.enrollmentData[1], enrollTotal);
            $scope.enrollRateData = [enrollPct, 100 - enrollPct];
            $scope.enrollRateOptions = withGaugeCenter(enrollPct, palette.sky);
        }

        $scope.applyFilter = function () {
            var groupId = $scope.selection.groupId === -1 ? null : $scope.selection.groupId;
            var configurationId = $scope.selection.configurationId === -1 ? null : $scope.selection.configurationId;

            if (groupId === null && configurationId === null) {
                $scope.filterActive = false;
                if ($scope.globalView) {
                    applyView($scope.globalView);
                }
                return;
            }

            $scope.filterActive = true;
            $scope.filterLoading = true;

            deviceService.getAllDevices({
                value: '',
                groupId: groupId,
                configurationId: configurationId,
                pageNum: 1,
                pageSize: 10000,
                sortBy: 'NUMBER',
                sortDir: 'ASC',
                fastSearch: false
            }, function (response) {
                $scope.filterLoading = false;
                var devices = (response.data && response.data.devices && response.data.devices.items) || [];
                applyView(computeFromDevices(devices));
            }, function () {
                $scope.filterLoading = false;
                $scope.errorMessage = localization.localize('error.internal.server');
            });
        };

        summaryService.getDeviceStat(function (response) {
            var devicesEnrolledEarlier = response.data.devicesEnrolled - response.data.devicesEnrolledLastMonth;
            if (devicesEnrolledEarlier < 0) {
                devicesEnrolledEarlier = 0;
            }
            var statusData = [0, 0, 0];
            $scope.installData = [0, 0, 0];

            response.data.statusSummary.forEach(function (item, index) {
                if (item.stringAttr === 'red') {
                    statusData[0] = item.number;
                } else if (item.stringAttr === 'yellow') {
                    statusData[1] = item.number;
                } else if (item.stringAttr === 'green') {
                    statusData[2] = item.number;
                }
            });

            response.data.installSummary.forEach(function (item, index) {
                if (item.stringAttr === 'FAILURE') {
                    $scope.installData[0] = item.number;
                } else if (item.stringAttr === 'VERSION_MISMATCH') {
                    $scope.installData[1] = item.number;
                } else if (item.stringAttr === 'SUCCESS') {
                    $scope.installData[2] = item.number;
                }
            });

            $scope.installOptions = withCenterText(String($scope.installData[0] + $scope.installData[1] + $scope.installData[2]));

            var installTotal = $scope.installData[0] + $scope.installData[1] + $scope.installData[2];
            var installPct = pct($scope.installData[2], installTotal);
            $scope.installRateData = [installPct, 100 - installPct];
            $scope.installRateOptions = withGaugeCenter(installPct, palette.navy);

            $scope.statusByConfigLabels = response.data.topConfigs;
            $scope.statusByConfigData = [];
            $scope.statusByConfigData.push(response.data.statusOfflineByConfig);
            $scope.statusByConfigData.push(response.data.statusIdleByConfig);
            $scope.statusByConfigData.push(response.data.statusOnlineByConfig);

            $scope.installByConfigLabels = $scope.statusByConfigLabels;
            $scope.installByConfigData = [];
            $scope.installByConfigData.push(response.data.appFailureByConfig);
            $scope.installByConfigData.push(response.data.appMismatchByConfig);
            $scope.installByConfigData.push(response.data.appSuccessByConfig);

            var monthlyEnrollLabels = [];
            var monthlyEnrollData = [];
            response.data.devicesEnrolledMonthly.forEach(function (item, index) {
                monthlyEnrollLabels.push(item.stringAttr);
                monthlyEnrollData.push(item.number);
            });

            $scope.globalView = {
                enrollmentData: [devicesEnrolledEarlier, response.data.devicesEnrolledLastMonth],
                statusData: statusData,
                monthlyEnrollLabels: monthlyEnrollLabels,
                monthlyEnrollData: monthlyEnrollData
            };
            applyView($scope.globalView);

        }, function () {
            $scope.errorMessage = localization.localize('error.internal.server');
        });

    });
