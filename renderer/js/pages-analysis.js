/*
 * 健康评估、历史趋势、阈值策略、离线设置
 */
(function (global) {
  "use strict";

  var Cloud = (global.Cloud = global.Cloud || {});
  var util = Cloud.util;
  var ui = Cloud.ui;
  var data = Cloud.data;
  var h = Cloud.pages.helpers;
  var filters = Cloud.pages.filters;

  function e(value) {
    return util.escapeHtml(value);
  }

  function topRisk(instance) {
    var factor = instance.riskFactors[0];
    return factor ? factor.label + " " + factor.percent + "%" : "--";
  }

  function pageHeader(title, subtitle, actions) {
    return ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: title }]) +
      ui.pageHead({ title: title, subtitle: subtitle, actions: actions || h.pageActions(null) });
  }

  Cloud.pages.health = function () {
    var instances = data.instances.slice().sort(function (a, b) { return a.health - b.health; });
    var stats = data.getStats();
    var attention = stats.warning + stats.fault;
    var avgLife = Math.round(instances.reduce(function (sum, instance) { return sum + instance.remainingLifeDays; }, 0) / instances.length);
    var rows = instances.map(function (instance) {
      return '<tr>' +
        '<td><a class="instance-name" href="' + h.instanceHref(instance) + '">' + h.instanceIcon(instance) +
          '<span><b>' + e(instance.name) + "</b><small>" + e(instance.id) + "</small></span></a></td>" +
        '<td>' + h.liveStatus(instance) + "</td>" +
        "<td>" + h.liveHealthCell(instance) + "</td>" +
        '<td><span class="risk-inline">' + e(topRisk(instance)) + "</span></td>" +
        '<td class="num">' + h.liveNumber(instance, "remainingLifeDays", 0) + '<span class="unit">天</span></td>' +
        '<td><span class="table-note">' + e(h.recommendations(instance)[0]) + "</span></td>" +
        '<td><a class="link" href="' + h.instanceHref(instance, "health") + '">健康分析</a></td>' +
      "</tr>";
    }).join("");

    var factorTotals = {};
    instances.forEach(function (instance) {
      instance.riskFactors.forEach(function (factor) {
        factorTotals[factor.label] = (factorTotals[factor.label] || 0) + factor.percent;
      });
    });
    var factorRows = Object.keys(factorTotals).map(function (label) {
      var value = Math.round(factorTotals[label] / instances.length);
      return '<div class="factor-row"><div class="factor-row__head"><span>' + e(label) + "</span><b>" + value + "%</b></div>" +
        '<div class="factor-bar"><i style="width:' + value + '%;background:#2563eb"></i></div></div>';
    }).join("");

    var recommendations = instances.filter(function (instance) { return instance.status === "fault" || instance.status === "warning"; })
      .slice(0, 2)
      .map(function (instance) {
        return '<li><span class="recommendation-dot"></span><div><strong>' + e(instance.name) + "</strong><p>" +
          e(h.recommendations(instance)[0]) + "</p></div></li>";
      }).join("");

    return pageHeader("健康评估", "汇总本地设备的 AI 健康评分、风险因子与剩余寿命预测") +
      '<div class="kpi-grid kpi-grid--four">' +
        ui.kpiCard({ label: "平均健康度", value: util.formatNumber(stats.averageHealth, 1), unit: "分", icon: "heart", color: "#00a870", foot: "全部在线实例" }) +
        ui.kpiCard({ label: "健康实例", value: stats.normal, unit: "台", icon: "check-circle", color: "#00a870", foot: "健康率 " + stats.healthyRate + "%" }) +
        ui.kpiCard({ label: "需关注实例", value: attention, unit: "台", icon: "alert", color: "#ff8f1f", foot: "含预警与故障" }) +
        ui.kpiCard({ label: "平均剩余寿命", value: avgLife, unit: "天", icon: "clock", color: "#2563eb", foot: "按当前工况预测" }) +
      "</div>" +
      '<section class="card card--table"><div class="card-head"><div class="card-head__title"><h2>实例健康排名</h2><p>健康度从低到高排列，便于优先处理</p></div>' +
        '<span class="tag tag--blue">AI 本地推理</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>实例</th><th>状态</th><th>健康度</th><th>主要风险因子</th><th>剩余寿命</th><th>首要建议</th><th>操作</th></tr></thead><tbody>' +
        rows + "</tbody></table></div></section>" +
      '<div class="assessment-layout">' +
        '<section class="card"><div class="card-head"><div class="card-head__title"><h2>健康分布</h2><p>全部实例状态构成</p></div></div>' +
          '<div class="card-body"><div class="assessment-distribution">' +
            ui.donut([
              { value: stats.normal, color: "#00a870" },
              { value: stats.warning, color: "#ff8f1f" },
              { value: stats.fault, color: "#f53f3f" },
              { value: stats.maintenance, color: "#c9cdd4" }
            ], { total: stats.total, centerLabel: "实例", size: 148 }) +
            '<div class="distribution__legend">' +
              '<div><span class="legend-dot" style="background:#00a870"></span><span>运行正常</span><strong>' + stats.normal + "</strong></div>" +
              '<div><span class="legend-dot" style="background:#ff8f1f"></span><span>预警关注</span><strong>' + stats.warning + "</strong></div>" +
              '<div><span class="legend-dot" style="background:#f53f3f"></span><span>故障告警</span><strong>' + stats.fault + "</strong></div>" +
              '<div><span class="legend-dot" style="background:#c9cdd4"></span><span>维护中</span><strong>' + stats.maintenance + "</strong></div>" +
            "</div>" +
          "</div></div></section>" +
        '<section class="card"><div class="card-head"><div class="card-head__title"><h2>风险因子汇总</h2><p>全部实例平均贡献权重</p></div></div>' +
          '<div class="card-body"><div class="factor-list factor-list--compact">' + factorRows + "</div></div></section>" +
      "</div>" +
      '<section class="card"><div class="card-head"><div class="card-head__title"><h2>全站健康度趋势</h2><p>近 24 小时 · 平均与最低健康度</p></div>' +
        '<div class="card-head__extra"><span class="chart-legend"><i style="background:#2563eb"></i>平均</span><span class="chart-legend"><i style="background:#ff8f1f"></i>最低</span></div></div>' +
        '<div class="card-body card-body--chart"><div class="chart-box chart-box--wide"><canvas id="assessmentTrendChart" aria-label="全站健康度趋势"></canvas></div></div></section>' +
      '<section class="card"><div class="card-head"><div class="card-head__title"><h2>优先处理建议</h2><p>按健康度排序，先处理高风险设备</p></div></div>' +
        '<div class="card-body"><ul class="recommendation-list">' +
          (recommendations || '<li><span class="recommendation-dot recommendation-dot--ok"></span><div><strong>全部设备运行平稳</strong><p>暂无需立即处理的健康风险。</p></div></li>') +
        "</ul></div></section>";
  };

  Cloud.pages.history = function () {
    var instance = data.getInstance(filters.historyInstanceId) || data.instances[0];
    var metric = filters.historyMetric || "health";
    var range = filters.historyRange || "24h";
    var meta = metric === "health" ? { label: "健康度", unit: "分" } : util.metricMeta(metric);
    var series = data.getSeries(instance.id, metric, range);
    var stats = h.resolveSeriesStats(series);
    var rows = instance.history.slice(-10).reverse().map(function (point) {
      return '<tr><td class="mono">' + util.formatDateTime(point.t, true) + "</td>" +
        '<td class="num">' + util.formatNumber(point.health, 1) + ' <span class="unit">分</span></td>' +
        '<td class="num">' + util.formatNumber(point.oilTemp, 1) + ' <span class="unit">°C</span></td>' +
        '<td class="num">' + util.formatNumber(point.load, 1) + ' <span class="unit">%</span></td>' +
        '<td class="num">' + util.formatNumber(point.vibration, 2) + ' <span class="unit">mm/s</span></td>' +
        '<td class="num">' + util.formatNumber(point.partialDischarge, 1) + ' <span class="unit">pC</span></td></tr>';
    }).join("");
    var instanceOptions = data.instances.map(function (item) {
      return '<option value="' + e(item.id) + '"' + (item.id === instance.id ? " selected" : "") + ">" + e(item.name) + "（" + e(item.code) + "）</option>";
    }).join("");
    var metricOptions = [
      { value: "health", label: "健康度" },
      { value: "oilTemp", label: "油温" },
      { value: "load", label: "负载率" },
      { value: "vibration", label: "振动" },
      { value: "partialDischarge", label: "局部放电" }
    ].map(function (item) {
      return '<option value="' + item.value + '"' + (item.value === metric ? " selected" : "") + ">" + item.label + "</option>";
    }).join("");

    return pageHeader("历史趋势", "查看本地保存的历史采样，支持实例、指标与时间范围切换") +
      '<section class="card filter-card"><div class="filter-bar">' +
        '<label class="inline-field">实例<select class="select" id="historyInstance">' + instanceOptions + "</select></label>" +
        '<label class="inline-field">指标<select class="select" id="historyMetric">' + metricOptions + "</select></label>" +
        '<div class="inline-field">范围' + ui.segmented([
          { value: "live", label: "实时" },
          { value: "30m", label: "30 分钟" },
          { value: "2h", label: "2 小时" },
          { value: "24h", label: "24 小时" }
        ], range, { group: "history" }) + "</div>" +
        '<span class="filter-bar__count">当前：<b>' + e(instance.name) + "</b> · " + e(meta.label) + "</span>" +
        '<button class="btn btn--secondary btn--sm filter-bar__right" type="button" data-action="export-history" data-instance="' + e(instance.id) + '">' +
          util.icon("download") + "<span>导出当前序列</span></button>" +
      "</div></section>" +
      '<div class="kpi-grid kpi-grid--four">' +
        ui.kpiCard({ label: "最新值", value: util.formatNumber(stats.latest, 1), unit: meta.unit, icon: "activity", color: "#2563eb", foot: "最近一次采样" }) +
        ui.kpiCard({ label: "平均值", value: util.formatNumber(stats.avg, 1), unit: meta.unit, icon: "chart", color: "#00a870", foot: "所选范围" }) +
        ui.kpiCard({ label: "最小值", value: util.formatNumber(stats.min, 1), unit: meta.unit, icon: "arrow-down", color: "#86909c", foot: "所选范围" }) +
        ui.kpiCard({ label: "最大值", value: util.formatNumber(stats.max, 1), unit: meta.unit, icon: "arrow-up", color: "#ff8f1f", foot: "所选范围" }) +
      "</div>" +
      '<section class="card"><div class="card-head"><div class="card-head__title"><h2>' + e(instance.name) + " · " + e(meta.label) + "趋势</h2>" +
        "<p>数据为本地历史缓冲与离线推演结合</p></div><span class=\"tag tag--neutral\">" + e(meta.unit) + "</span></div>" +
        '<div class="card-body card-body--chart"><div class="chart-box chart-box--history"><canvas id="historyChart" aria-label="历史趋势图"></canvas></div></div></section>' +
      '<section class="card card--table"><div class="card-head"><div class="card-head__title"><h2>最近采样明细</h2><p>本机内存中的最近 10 条记录</p></div>' +
        '<span class="tag tag--green">本地</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>采样时间</th><th>健康度</th><th>油温</th><th>负载率</th><th>振动</th><th>局部放电</th></tr></thead><tbody>' +
        rows + "</tbody></table></div></section>";
  };

  Cloud.pages.strategies = function () {
    var defaults = data.defaultThresholds;
    var rows = data.instances.map(function (instance) {
      return '<tr>' +
        '<td><div class="instance-name">' + h.instanceIcon(instance) + '<span><b>' + e(instance.name) + "</b><small>" + e(instance.id) + "</small></span></div></td>" +
        '<td>' + h.liveStatus(instance) + "</td>" +
        '<td class="num">' + instance.thresholds.normalLower + " / " + instance.thresholds.warningLower + "</td>" +
        '<td class="num">' + instance.thresholds.oilAlarm + ' <span class="unit">°C</span></td>' +
        '<td class="num">' + instance.thresholds.vibrationAlarm + ' <span class="unit">mm/s</span></td>' +
        '<td class="num">' + instance.thresholds.partialDischargeAlarm + ' <span class="unit">pC</span></td>' +
        '<td class="num">' + instance.thresholds.loadAlarm + ' <span class="unit">%</span></td>' +
        '<td><a class="link" href="' + h.instanceHref(instance, "config") + '">编辑</a></td>' +
      "</tr>";
    }).join("");

    return pageHeader("阈值策略", "管理全局默认阈值与各实例的个性化告警策略，全部保存在本机") +
      '<div class="local-note">' + util.icon("shield") + "<span>策略变更只影响本地判定逻辑，不会同步或上传到任何远端系统。</span></div>" +
      '<section class="card"><div class="card-head"><div class="card-head__title"><h2>全局默认阈值</h2><p>保存后可一键应用到全部实例</p></div>' +
        '<span class="tag tag--blue">DEFAULT POLICY</span></div>' +
        '<div class="card-body"><form id="globalThresholdForm" data-form="global-thresholds">' +
          '<div class="form-grid form-grid--threshold">' + h.thresholdInputs(defaults, "global") + "</div>" +
          '<p class="form-error" id="globalThresholdError"></p>' +
          '<div class="form-actions"><button class="btn btn--primary" type="submit">' + util.icon("check-circle") + "<span>应用到全部实例</span></button>" +
          '<button class="btn btn--secondary" type="button" data-action="reset-all-thresholds">' + util.icon("rotate") + "<span>恢复初始策略</span></button></div>" +
        "</form></div></section>" +
      '<section class="card card--table"><div class="card-head"><div class="card-head__title"><h2>实例策略覆盖</h2><p>各实例当前生效的阈值</p></div>' +
        '<span class="tag tag--neutral">' + data.instances.length + " 台实例</span></div>" +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>实例</th><th>状态</th><th>健康下限 / 预警下限</th><th>油温告警</th><th>振动告警</th><th>局放告警</th><th>负载告警</th><th>操作</th></tr></thead><tbody>' +
        rows + "</tbody></table></div></section>";
  };

  Cloud.pages.settings = function () {
    var isElectron = navigator.userAgent.indexOf("Electron") >= 0;
    var storageBytes = 0;
    try {
      for (var key in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;
        storageBytes += (localStorage.getItem(key) || "").length * 2;
      }
    } catch (error) {
      storageBytes = 0;
    }
    var storageText = storageBytes > 1024 * 1024
      ? (storageBytes / 1024 / 1024).toFixed(1) + " MB"
      : Math.max(1, Math.round(storageBytes / 1024)) + " KB";
    var settings = data.settings;
    var counts = data.getAlarmCounts();

    return pageHeader("离线设置", "查看离线运行状态、模拟数据参数与本地存储") +
      '<div class="settings-grid">' +
        '<section class="card"><div class="card-head"><div class="card-head__title"><h2>离线运行状态</h2><p>当前版本不建立任何远程连接</p></div>' +
          '<span class="tag tag--green">LOCAL ONLY</span></div>' +
          '<div class="card-body"><ul class="check-list">' +
            '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>外部网络请求</strong><p>" +
              (isElectron ? "Electron 主进程已拦截 HTTP / HTTPS / WebSocket 请求" : "页面未包含任何外部资源或网络请求") + "</p></div></li>" +
            '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>远程更新与账号登录</strong><p>未启用自动更新、云账号登录和远程配置下发</p></div></li>" +
            '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>数据存储</strong><p>模拟数据、阈值和确认状态均保存在本机</p></div></li>" +
            '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>桌面安装包</strong><p>全部前端资源与应用运行时随安装包分发，无需联网加载</p></div></li>" +
          "</ul></div></section>" +

        '<section class="card"><div class="card-head"><div class="card-head__title"><h2>模拟数据参数</h2><p>自动刷新与手动控制</p></div>' +
          '<span class="tag tag--blue">SIMULATOR</span></div>' +
          '<div class="card-body"><div class="settings-form">' +
            '<div class="settings-row"><div><strong>自动刷新</strong><p>按固定间隔生成新的模拟采样</p></div>' +
              ui.switchControl("settingsAutoRefresh", settings.autoRefresh) + "</div>" +
            '<div class="settings-row"><div><strong>采样间隔</strong><p>只影响本机模拟器，不影响其他设置</p></div>' +
              '<select class="select" id="settingsInterval">' +
                [1000, 2000, 5000].map(function (ms) {
                  return '<option value="' + ms + '"' + (settings.intervalMs === ms ? " selected" : "") + ">" + ms / 1000 + " 秒</option>";
                }).join("") + "</select></div>" +
            '<div class="settings-row"><div><strong>立即采样</strong><p>即使暂停自动刷新，也可以手动推进一次</p></div>' +
              '<button class="btn btn--secondary btn--sm" type="button" data-action="refresh-data">' + util.icon("refresh") + "<span>立即刷新</span></button></div>" +
            '<div class="settings-row"><div><strong>手动调节</strong><p>在模拟控制台内拖动指标滑块，实时重算健康度</p></div>' +
              '<button class="btn btn--primary btn--sm" type="button" data-action="open-sim" data-instance="TR-220-001">' + util.icon("sliders") + "<span>打开控制台</span></button></div>" +
          "</div></div></section>" +

        '<section class="card"><div class="card-head"><div class="card-head__title"><h2>本地存储</h2><p>设置、阈值与告警确认状态</p></div></div>' +
          '<div class="card-body"><div class="storage-stat"><div><span>已用存储</span><strong>' + e(storageText) + "</strong></div>" +
            '<div><span>实例数量</span><strong>' + data.instances.length + "</strong></div>" +
            '<div><span>告警记录</span><strong>' + counts.total + "</strong></div>" +
            '<div><span>未处理</span><strong class="text-danger">' + counts.open + "</strong></div></div>" +
          '<div class="settings-actions"><button class="btn btn--secondary" type="button" data-action="export-snapshot">' + util.icon("download") + "<span>导出本地快照</span></button>" +
          '<button class="btn btn--danger-ghost" type="button" data-action="reset-demo">' + util.icon("rotate") + "<span>重置演示数据</span></button></div>" +
          '<p class="form-note form-note--plain">重置将清空本机阈值、告警确认状态并恢复初始模拟数据。</p></div></section>' +

        '<section class="card"><div class="card-head"><div class="card-head__title"><h2>关于应用</h2><p>安装包内自带运行环境</p></div></div>' +
          '<div class="card-body"><div class="about-app"><div class="about-logo"><svg viewBox="0 0 36 36"><path d="M20.8 3.5 8.7 20.3h8.1l-1.6 12.2 12.1-16.8h-8.1l1.6-12.2Z"/></svg></div>' +
            '<div><strong>变压器离线运维控制台</strong><p>版本 2.0.0 · Windows x64</p></div></div>' +
          '<dl class="description-list description-list--compact">' +
            '<div><dt>运行模式</dt><dd>本地桌面应用</dd></div>' +
            '<div><dt>数据源</dt><dd>内置模拟器</dd></div>' +
            '<div><dt>外部依赖</dt><dd>无</dd></div>' +
            '<div><dt>网络状态</dt><dd class="text-success">完全离线</dd></div>' +
          "</dl></div></section>" +
      "</div>";
  };

  Cloud.pages.notFound = function () {
    return ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: "未找到页面" }]) +
      ui.pageHead({ title: "页面不存在", subtitle: "请通过左侧导航进入有效页面" }) +
      '<div class="card"><div class="card-body">' + ui.emptyState("未找到请求的页面", "该实例或页面可能已被移除，请返回运维总览。", "search") +
        '<div class="empty-actions"><a class="btn btn--primary" href="#/overview">返回运维总览</a></div>' +
      "</div></div>";
  };

  function averageHealthSeries(range) {
    var online = data.instances.filter(function (instance) { return instance.status !== "maintenance"; });
    if (!online.length) return { labels: [], avg: [], min: [] };
    var primary = data.getSeries(online[0].id, "health", range);
    var all = online.map(function (instance) {
      return data.getSeries(instance.id, "health", range).values;
    });
    var avg = primary.values.map(function (_value, index) {
      var sum = 0;
      var min = 100;
      all.forEach(function (series) {
        var value = Number(series[index]) || 0;
        sum += value;
        min = Math.min(min, value);
      });
      return sum / all.length;
    });
    var minValues = primary.values.map(function (_value, index) {
      return Math.min.apply(null, all.map(function (series) { return Number(series[index]) || 0; }));
    });
    return { labels: primary.labels, avg: avg, min: minValues };
  }

  function createAverageChart(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var series = averageHealthSeries("24h");
    var thresholds = data.defaultThresholds;
    var chart = Cloud.charts.create(canvas, {
      labels: series.labels,
      unit: "分",
      decimals: 1,
      yMin: 0,
      yMax: 100,
      series: [
        { name: "平均健康度", values: series.avg, color: "#2563eb", fill: true },
        { name: "最低健康度", values: series.min, color: "#ff8f1f" }
      ],
      thresholds: [
        { value: thresholds.normalLower, color: "#ff8f1f" },
        { value: thresholds.warningLower, color: "#f53f3f" }
      ]
    });
    return {
      chart: chart,
      refresh: function () {
        var next = averageHealthSeries("24h");
        chart.update({
          labels: next.labels,
          series: [
            { name: "平均健康度", values: next.avg, color: "#2563eb", fill: true },
            { name: "最低健康度", values: next.min, color: "#ff8f1f" }
          ]
        });
      }
    };
  }

  Cloud.pages.analysisMount = function (route) {
    var charts = [];
    if (route.name === "overview") {
      var overview = createAverageChart("overviewTrendChart");
      if (overview) charts.push(overview);
    } else if (route.name === "health") {
      var assessment = createAverageChart("assessmentTrendChart");
      if (assessment) charts.push(assessment);
    } else if (route.name === "history") {
      var canvas = document.getElementById("historyChart");
      if (canvas) {
        var instance = data.getInstance(filters.historyInstanceId) || data.instances[0];
        var metric = filters.historyMetric || "health";
        var range = filters.historyRange || "24h";
        var meta = metric === "health" ? { label: "健康度", unit: "分" } : util.metricMeta(metric);
        var series = data.getSeries(instance.id, metric, range);
        var color = metric === "health" ? util.stateTheme(instance.status).color : meta.color;
        var chart = Cloud.charts.create(canvas, {
          labels: series.labels,
          unit: meta.unit,
          decimals: 1,
          yMin: 0,
          yMax: metric === "health" ? 100 : metric === "vibration" ? 8 : metric === "load" || metric === "oilTemp" ? 110 : 100,
          series: [{ name: meta.label, values: series.values, color: color, fill: metric === "health" }],
          thresholds: metric === "health"
            ? [{ value: instance.thresholds.normalLower, color: "#ff8f1f" }, { value: instance.thresholds.warningLower, color: "#f53f3f" }]
            : [{ value: instance.thresholds[meta.thresholdKey], color: "#ff8f1f" }]
        });
        charts.push({
          chart: chart,
          refresh: function () {
            var current = data.getInstance(instance.id);
            if (!current) return;
            var next = data.getSeries(instance.id, metric, range);
            var nextColor = metric === "health" ? util.stateTheme(current.status).color : meta.color;
            chart.update({
              labels: next.labels,
              series: [{ name: meta.label, values: next.values, color: nextColor, fill: metric === "health" }]
            });
          }
        });
      }
    }
    return charts;
  };

  Cloud.pages.mount = function (route) {
    if (route.name === "instance") return Cloud.pages.instanceMount(route, data.getInstance(route.instanceId));
    return Cloud.pages.analysisMount(route);
  };
})(window);
