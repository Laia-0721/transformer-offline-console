/*
 * 总览、实例列表、采集节点、告警中心、巡检任务
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

  function instanceRow(instance) {
    return '<tr data-instance-row data-instance="' + e(instance.id) + '" data-status="' + e(instance.status) +
      '" data-location="' + e(instance.locationCode) + '" data-search="' +
      e((instance.name + " " + instance.id + " " + instance.code + " " + instance.voltage).toLowerCase()) + '">' +
      '<td><a class="instance-name" href="' + h.instanceHref(instance) + '">' +
        h.instanceIcon(instance) +
        '<span><b>' + e(instance.name) + "</b><small>" + e(instance.id) + "</small></span>" +
      "</a></td>" +
      '<td>' + h.liveStatus(instance) + "</td>" +
      "<td>" + h.liveHealthCell(instance) + "</td>" +
      '<td class="num">' + h.liveNumber(instance, "metrics.oilTemp", 1) + '<span class="unit">°C</span></td>' +
      '<td class="num">' + h.liveNumber(instance, "metrics.load", 1) + '<span class="unit">%</span></td>' +
      '<td class="num">' + h.liveNumber(instance, "metrics.vibration", 1) + '<span class="unit">mm/s</span></td>' +
      '<td class="num">' + h.liveNumber(instance, "metrics.partialDischarge", 1) + '<span class="unit">pC</span></td>' +
      '<td><span class="collector-cell">' + util.icon("cpu") + e(instance.collector) + "</span></td>" +
      '<td class="muted">' + h.liveUpdated(instance) + "</td>" +
      '<td class="table-actions"><a class="link" href="' + h.instanceHref(instance, "overview") + '">详情</a>' +
        '<button class="link link--button" type="button" data-action="open-sim" data-instance="' + e(instance.id) + '">模拟</button></td>' +
    "</tr>";
  }

  function alarmTable(alarms, options) {
    options = options || {};
    if (!alarms.length) return "";
    return alarms.map(function (alarm) {
      var instance = data.getInstance(alarm.instanceId);
      var severity = util.severityMeta(alarm.severity);
      var open = alarm.status === "open";
      return '<tr data-alarm-row data-alarm-id="' + e(alarm.id) + '" data-severity="' + e(alarm.severity) +
        '" data-status="' + e(alarm.status) + '" data-instance="' + e(alarm.instanceId) +
        '" data-search="' + e((alarm.category + " " + alarm.message + " " + alarm.instanceId + " " +
          (instance ? instance.name : "")).toLowerCase()) + '">' +
        '<td class="time-cell" title="' + e(util.formatDateTime(alarm.createdAt, true)) + '">' +
          '<strong>' + util.formatShortDate(alarm.createdAt) + "</strong>" +
          '<small>' + util.timeAgo(alarm.createdAt) + "</small>" +
        "</td>" +
        '<td>' + ui.severityTag(alarm.severity) + "</td>" +
        '<td><div class="alarm-cell"><strong>' + e(alarm.category) + "</strong><small>" + e(alarm.message) + "</small></div></td>" +
        (options.showInstance ? '<td><a class="link" href="' + (instance ? h.instanceHref(instance) : "#/instances") + '">' +
          e(instance ? instance.name : alarm.instanceId) + "</a></td>" : "") +
        '<td><span class="alarm-value">' + util.formatNumber(alarm.triggerValue, alarm.unit === "mm/s" ? 1 : 1) +
          " " + e(alarm.unit) + '</span><small class="muted">阈值 ' + e(alarm.threshold) + " " + e(alarm.unit) + "</small></td>" +
        '<td><span class="source-label">' + e(alarm.source) + "</span></td>" +
        '<td>' + (open
          ? ui.tag("待处理", "danger", { dot: true })
          : ui.tag("已确认", "success", { dot: true })) + "</td>" +
        '<td class="table-actions">' + (open
          ? '<button class="btn btn--xs btn--secondary" type="button" data-action="ack-alarm" data-alarm="' + e(alarm.id) + '">确认</button>'
          : '<span class="muted">' + e(alarm.acknowledgedBy || "运维管理员") + "</span>") +
        "</td>" +
      "</tr>";
    }).join("");
  }

  Cloud.pages.helpers.alarmTable = alarmTable;

  Cloud.pages.overview = function () {
    var stats = data.getStats();
    var alarms = data.getRecentAlarms(5);
    var openCritical = data.getAlarms({ severity: "critical", status: "open" });
    var instances = data.instances;
    var avgSeries = [];
    for (var i = 0; i < 48; i += 1) {
      avgSeries.push(stats.averageHealth + Math.sin(i / 4.2) * 1.8 + Math.cos(i / 9) * 0.9);
    }
    var content = ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: "运维总览" }]) +
      ui.pageHead({
        title: "运维总览",
        subtitle: "本地实时状态与设备健康全景 · 数据源：内置离线模拟器",
        actions: h.pageActions(null)
      });

    if (stats.openAlarms > 0) {
      content += '<div class="overview-alert">' +
        '<span class="overview-alert__icon">' + util.icon("alert") + "</span>" +
        '<div><strong>当前有 ' + stats.openAlarms + " 条待处理告警</strong>" +
        "<p>其中严重告警 " + openCritical.length + " 条，请优先处理站用变压器振动与局放异常。</p></div>" +
        '<a class="btn btn--sm btn--danger-ghost" href="#/alarms">前往告警中心' + util.icon("chevron-right") + "</a>" +
      "</div>";
    }

    content += '<div class="kpi-grid">' +
      ui.kpiCard({
        label: "变压器实例",
        value: stats.total,
        unit: "台",
        icon: "server",
        color: "#2563eb",
        foot: '<span class="text-success">' + stats.online + " 台已接入</span><span class=\"dot-sep\"></span><span>" + stats.maintenance + " 台维护中</span>"
      }) +
      ui.kpiCard({
        label: "平均健康度",
        value: '<span data-live-kpi="averageHealth">' + util.formatNumber(stats.averageHealth, 1) + "</span>",
        unit: "分",
        icon: "heart",
        color: "#00a870",
        foot: '<span class="text-success">健康实例 ' + stats.normal + " 台</span><span class=\"dot-sep\"></span><span>健康率 " + stats.healthyRate + "%</span>",
        spark: ui.sparkline(avgSeries, "#00a870")
      }) +
      ui.kpiCard({
        label: "待处理告警",
        value: '<span data-live-kpi="openAlarms">' + stats.openAlarms + "</span>",
        unit: "条",
        icon: "alert",
        color: "#f53f3f",
        foot: '<span class="text-danger">严重 ' + data.getAlarmCounts().critical + "</span><span class=\"dot-sep\"></span><span>预警 " + data.getAlarmCounts().warning + "</span>"
      }) +
      ui.kpiCard({
        label: "本地模拟器",
        value: data.settings.autoRefresh ? "运行中" : "已暂停",
        icon: "activity",
        color: "#7c3aed",
        foot: '<span class="inline-dot ' + (data.settings.autoRefresh ? "is-online" : "is-paused") + '"></span>' +
          '<span data-live-kpi="simText">' + (data.settings.autoRefresh ? "每 " + data.settings.intervalMs / 1000 + " 秒自动采样" : "自动采样已暂停") + "</span>"
      }) +
    "</div>";

    var rows = instances.map(function (instance) {
      return '<tr data-instance="' + e(instance.id) + '">' +
        '<td><a class="instance-name" href="' + h.instanceHref(instance) + '">' + h.instanceIcon(instance) +
          '<span><b>' + e(instance.name) + "</b><small>" + e(instance.id) + "</small></span></a></td>" +
        '<td>' + h.liveStatus(instance) + "</td>" +
        "<td>" + h.liveHealthCell(instance) + "</td>" +
        '<td class="num">' + h.liveNumber(instance, "metrics.load", 1) + '<span class="unit">%</span></td>' +
        '<td class="num">' + h.liveNumber(instance, "metrics.oilTemp", 1) + '<span class="unit">°C</span></td>' +
        '<td class="muted">' + h.liveUpdated(instance) + "</td>" +
        '<td><a class="link" href="' + h.instanceHref(instance) + '">查看详情</a></td>' +
      "</tr>";
    }).join("");

    var healthTable = '<section class="card card--table">' +
      '<div class="card-head"><div class="card-head__title"><h2>实例健康态势</h2><p>按健康度实时刷新，点击实例进入详细诊断</p></div>' +
        '<div class="card-head__extra"><a class="text-link" href="#/instances">全部实例' + util.icon("chevron-right") + "</a></div></div>" +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        "<th>实例名称</th><th>状态</th><th>健康度</th><th>负载率</th><th>油温</th><th>最近更新</th><th>操作</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div></section>";

    var distribution = '<section class="card">' +
      '<div class="card-head"><div class="card-head__title"><h2>健康状态分布</h2><p>全部本地实例</p></div>' +
        '<span class="tag tag--neutral">' + stats.total + " 台</span></div>" +
      '<div class="card-body"><div class="distribution">' +
        ui.donut([
          { value: stats.normal, color: "#00a870" },
          { value: stats.warning, color: "#ff8f1f" },
          { value: stats.fault, color: "#f53f3f" },
          { value: stats.maintenance, color: "#c9cdd4" }
        ], { total: stats.total, centerLabel: "实例", size: 142 }) +
        '<div class="distribution__legend">' +
          '<div><span class="legend-dot" style="background:#00a870"></span><span>运行正常</span><strong>' + stats.normal + "</strong></div>" +
          '<div><span class="legend-dot" style="background:#ff8f1f"></span><span>预警关注</span><strong>' + stats.warning + "</strong></div>" +
          '<div><span class="legend-dot" style="background:#f53f3f"></span><span>故障告警</span><strong>' + stats.fault + "</strong></div>" +
          '<div><span class="legend-dot" style="background:#c9cdd4"></span><span>维护中</span><strong>' + stats.maintenance + "</strong></div>" +
        "</div></div>" +
        '<div class="distribution__foot"><span class="inline-dot ' + (data.settings.autoRefresh ? "is-online" : "is-paused") + '"></span>' +
          '<span>本地模拟器</span><strong>' + (data.settings.autoRefresh ? "2 秒采样" : "已暂停") + "</strong>" +
          '<button class="text-button" type="button" data-action="open-sim" data-instance="TR-220-001">调整</button></div>' +
      "</div></section>";

    var trendCard = '<section class="card">' +
      '<div class="card-head"><div class="card-head__title"><h2>全站健康度趋势</h2><p>近 24 小时 · 本地推演数据</p></div>' +
        '<div class="card-head__extra"><span class="chart-legend"><i style="background:#2563eb"></i>平均健康度</span>' +
          '<span class="chart-legend"><i style="background:#ff8f1f"></i>最低健康度</span></div></div>' +
      '<div class="card-body card-body--chart"><div class="chart-box chart-box--overview"><canvas id="overviewTrendChart" aria-label="全站健康度趋势图"></canvas></div></div>' +
    "</section>";

    var recentAlarmCard = '<section class="card">' +
      '<div class="card-head"><div class="card-head__title"><h2>最近告警</h2><p>最新 5 条本地事件</p></div>' +
        '<a class="text-link" href="#/alarms">查看全部' + util.icon("chevron-right") + "</a></div>" +
      '<div class="card-body card-body--flush"><div class="alarm-list">' +
        (alarms.length ? alarms.map(function (alarm) { return h.alarmItem(alarm, true); }).join("") :
          ui.emptyState("暂无告警", "本地设备运行平稳", "check-circle")) +
      "</div></div></section>";

    content += '<div class="overview-layout">' +
      '<div class="overview-layout__main">' + healthTable + trendCard + "</div>" +
      '<div class="overview-layout__side">' + distribution + recentAlarmCard + "</div>" +
    "</div>";

    return content;
  };

  Cloud.pages.instances = function () {
    var locations = [];
    data.instances.forEach(function (instance) {
      if (locations.indexOf(instance.locationCode) < 0) locations.push(instance.locationCode);
    });
    var options = locations.map(function (code) {
      return '<option value="' + e(code) + '"' + (filters.instancesLocation === code ? " selected" : "") + ">" + e(code) + "</option>";
    }).join("");

    var content = ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: "资源管理" }, { label: "变压器实例" }]) +
      ui.pageHead({
        title: "变压器实例",
        subtitle: "管理本地变压器资源与采集通道，所有数据均来自本机模拟器",
        actions: '<button class="btn btn--secondary" type="button" data-action="export-instances">' +
          util.icon("download") + "<span>导出清单</span></button>" + h.pageActions(null)
      });

    content += '<section class="card filter-card"><div class="filter-bar">' +
      '<label class="search-field"><svg class="icon"><use href="#i-search"></use></svg>' +
        '<input id="instanceSearch" type="search" placeholder="搜索实例名称、ID、电压等级" value="' + e(filters.instancesSearch) + '" autocomplete="off"></label>' +
      '<select id="instanceStatusFilter" class="select" aria-label="按状态筛选">' +
        '<option value="all"' + (filters.instancesStatus === "all" ? " selected" : "") + ">全部状态</option>" +
        '<option value="normal"' + (filters.instancesStatus === "normal" ? " selected" : "") + ">运行正常</option>" +
        '<option value="warning"' + (filters.instancesStatus === "warning" ? " selected" : "") + ">预警</option>" +
        '<option value="fault"' + (filters.instancesStatus === "fault" ? " selected" : "") + ">故障</option>" +
        '<option value="maintenance"' + (filters.instancesStatus === "maintenance" ? " selected" : "") + ">维护中</option>" +
      "</select>" +
      '<select id="instanceLocationFilter" class="select" aria-label="按机房筛选">' +
        '<option value="all"' + (filters.instancesLocation === "all" ? " selected" : "") + ">全部机房</option>" + options +
      "</select>" +
      '<button class="btn btn--ghost" type="button" data-action="reset-instance-filters">' + util.icon("rotate") + "<span>重置</span></button>" +
      '<span class="filter-bar__count">共 <b id="instanceResultCount">' + data.instances.length + "</b> 台实例</span>" +
    "</div></section>";

    content += '<section class="card card--table">' +
      '<div class="card-head"><div class="card-head__title"><h2>实例列表</h2><p>本地资源池 · 模拟数据每 ' +
        (data.settings.intervalMs / 1000) + " 秒刷新</p></div>" +
        '<div class="card-head__extra"><span class="tag tag--blue">LOCAL</span></div></div>' +
      '<div class="table-wrap"><table class="data-table data-table--instances"><thead><tr>' +
        "<th>实例名称 / ID</th><th>状态</th><th>健康度</th><th>油温</th><th>负载率</th><th>振动</th><th>局放</th><th>采集通道</th><th>最近更新</th><th>操作</th>" +
      "</tr></thead><tbody id=\"instanceTableBody\">" +
        data.instances.map(instanceRow).join("") +
        '<tr id="instanceEmptyRow" hidden><td colspan="10">' + ui.emptyState("未找到匹配实例", "请调整搜索关键词或筛选条件", "search") + "</td></tr>" +
      "</tbody></table></div>" +
      '<div class="table-footer"><span>共 <b id="instanceFooterCount">' + data.instances.length + "</b> 条记录</span>" +
        '<div class="pagination"><button class="page-btn" type="button" disabled>' + util.icon("chevron-left") + "</button>" +
        '<span class="page-btn is-active">1</span>' +
        '<button class="page-btn" type="button" disabled>' + util.icon("chevron-right") + "</button></div></div>" +
    "</section>";

    content += '<div class="local-note">' + util.icon("lock") +
      '<span>该列表完全由本机模拟器提供，不包含公网 IP、区域可用区或任何远程连接信息。</span></div>';

    return content;
  };

  Cloud.pages.nodes = function () {
    var nodes = data.getNodes();
    var online = nodes.filter(function (node) { return node.status === "online"; }).length;
    var rows = nodes.map(function (node) {
      var instance = node.instance;
      return '<tr data-node-row>' +
        '<td><div class="instance-name">' + h.instanceIcon(instance) + '<span><b>' + e(node.name) + "</b><small>" + e(node.id) + "</small></span></div></td>" +
        '<td><span class="status-tag status-tag--success"><span class="status-tag__dot"></span>' + (node.status === "online" ? "在线" : "待机") + "</span></td>" +
        '<td><a class="link" href="' + (instance ? h.instanceHref(instance) : "#/instances") + '">' + e(instance ? instance.name : "--") + "</a></td>" +
        '<td><span class="collector-cell">' + util.icon("database") + e(node.protocol) + "</span></td>" +
        '<td class="num">' + node.latency + '<span class="unit">ms</span></td>' +
        '<td class="num">' + Number(node.packets).toLocaleString("zh-CN") + "</td>" +
        '<td class="muted">' + util.formatDateTime(node.lastSync, true) + "</td>" +
        '<td><span class="tag tag--neutral">' + e(node.version) + "</span></td>" +
      "</tr>";
    }).join("");

    return ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: "资源管理" }, { label: "采集节点" }]) +
      ui.pageHead({
        title: "本地采集节点",
        subtitle: "全部采集通道均在本机运行，不建立远程连接",
        actions: h.pageActions(null)
      }) +
      '<div class="kpi-grid kpi-grid--three">' +
        ui.kpiCard({ label: "采集通道", value: nodes.length, unit: "个", icon: "cpu", color: "#2563eb", foot: "本机虚拟适配器" }) +
        ui.kpiCard({ label: "在线通道", value: online, unit: "个", icon: "check-circle", color: "#00a870", foot: "数据刷新正常" }) +
        ui.kpiCard({ label: "外部网络", value: "已禁用", icon: "wifi-off", color: "#f53f3f", foot: "不存在远程数据连接" }) +
      "</div>" +
      '<section class="card card--table"><div class="card-head"><div class="card-head__title"><h2>采集通道列表</h2><p>LOCAL SIMULATION BUS</p></div>' +
        '<span class="tag tag--green">离线总线</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>通道名称</th><th>状态</th><th>绑定实例</th><th>采集协议</th><th>本机时延</th><th>累计采样</th><th>最近同步</th><th>版本</th></tr></thead><tbody>' +
        rows + "</tbody></table></div></section>" +
      '<div class="local-note">' + util.icon("info") + '<span>节点名称为本地模拟通道，不对应任何物理网络地址。</span></div>';
  };

  Cloud.pages.alarms = function () {
    var counts = data.getAlarmCounts();
    var alarms = data.getAlarms({
      severity: filters.alarmSeverity,
      status: filters.alarmStatus,
      query: filters.alarmSearch
    });

    var content = ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: "监控运维" }, { label: "告警中心" }]) +
      ui.pageHead({
        title: "告警中心",
        subtitle: "汇总本地实例的全部阈值告警、健康模型告警与巡检事件",
        actions: '<button class="btn btn--secondary" type="button" data-action="ack-all-alarms">' +
          util.icon("check-circle") + "<span>全部确认</span></button>" + h.pageActions(null)
      });

    content += '<div class="kpi-grid kpi-grid--four">' +
      ui.kpiCard({ label: "待处理告警", value: counts.open, unit: "条", icon: "alert", color: "#f53f3f", foot: "需人工确认" }) +
      ui.kpiCard({ label: "严重告警", value: counts.critical, unit: "条", icon: "alert", color: "#f53f3f", foot: "最高优先级" }) +
      ui.kpiCard({ label: "警告", value: counts.warning, unit: "条", icon: "info", color: "#ff8f1f", foot: "建议尽快查看" }) +
      ui.kpiCard({ label: "已确认", value: counts.acknowledged, unit: "条", icon: "check-circle", color: "#00a870", foot: "已纳入巡检记录" }) +
    "</div>";

    content += '<section class="card filter-card"><div class="filter-bar">' +
      '<label class="search-field"><svg class="icon"><use href="#i-search"></use></svg>' +
        '<input id="alarmSearch" type="search" placeholder="搜索告警类型、实例或描述" value="' + e(filters.alarmSearch) + '" autocomplete="off"></label>' +
      '<select id="alarmSeverityFilter" class="select" aria-label="按级别筛选">' +
        '<option value="all"' + (filters.alarmSeverity === "all" ? " selected" : "") + ">全部级别</option>" +
        '<option value="critical"' + (filters.alarmSeverity === "critical" ? " selected" : "") + ">严重</option>" +
        '<option value="warning"' + (filters.alarmSeverity === "warning" ? " selected" : "") + ">警告</option>" +
        '<option value="info"' + (filters.alarmSeverity === "info" ? " selected" : "") + ">提示</option>" +
      "</select>" +
      '<select id="alarmStatusFilter" class="select" aria-label="按状态筛选">' +
        '<option value="all"' + (filters.alarmStatus === "all" ? " selected" : "") + ">全部状态</option>" +
        '<option value="open"' + (filters.alarmStatus === "open" ? " selected" : "") + ">待处理</option>" +
        '<option value="acknowledged"' + (filters.alarmStatus === "acknowledged" ? " selected" : "") + ">已确认</option>" +
      "</select>" +
      '<button class="btn btn--ghost" type="button" data-action="reset-alarm-filters">' + util.icon("rotate") + "<span>重置</span></button>" +
      '<span class="filter-bar__count">共 <b id="alarmResultCount">' + alarms.length + "</b> 条告警</span>" +
    "</div></section>";

    content += '<section class="card card--table"><div class="card-head"><div class="card-head__title"><h2>告警列表</h2><p>按产生时间倒序排列</p></div>' +
      '<span class="tag tag--red">' + counts.open + " 条待处理</span></div>" +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>产生时间</th><th>级别</th><th>告警内容</th><th>关联实例</th><th>触发值 / 阈值</th><th>来源</th><th>状态</th><th>操作</th></tr></thead>' +
      '<tbody id="alarmCenterBody">' + alarmTable(alarms, { showInstance: true }) +
      '<tr id="alarmEmptyRow" hidden><td colspan="8">' + ui.emptyState("未找到匹配告警", "请调整筛选条件", "search") + "</td></tr>" +
      "</tbody></table></div>" +
      '<div class="table-footer"><span>共 <b id="alarmFooterCount">' + alarms.length + "</b> 条记录</span><span class=\"muted\">所有告警存储于本机</span></div></section>";

    return content;
  };

  Cloud.pages.inspections = function () {
    var tasks = data.getTasks();
    var running = tasks.filter(function (task) { return task.status === "running"; }).length;
    var success = tasks.filter(function (task) { return task.status === "success"; }).length;
    var cards = tasks.map(function (task) {
      var status = task.status === "running"
        ? ui.tag("运行中", "blue", { dot: true })
        : task.status === "success" ? ui.tag("已完成", "success", { dot: true }) : ui.tag("待执行", "neutral", { dot: true });
      return '<article class="inspection-card" data-task-card="' + e(task.id) + '">' +
        '<div class="inspection-card__head"><div class="inspection-card__icon">' + util.icon("clipboard") + "</div>" +
          '<div><h3>' + e(task.name) + "</h3><p>" + e(task.targets) + "</p></div>" + status + "</div>" +
        '<div class="inspection-card__meta"><div><span>执行方式</span><strong>' + e(task.mode) + "</strong></div>" +
          '<div><span>调度周期</span><strong>' + e(task.schedule) + "</strong></div>" +
          '<div><span>上次执行</span><strong>' + (task.lastRun ? util.timeAgo(task.lastRun) : "--") + "</strong></div>" +
          '<div><span>耗时</span><strong>' + e(task.duration) + "</strong></div></div>" +
        '<div class="inspection-card__summary ' + (task.findings ? "has-findings" : "") + '">' +
          util.icon(task.findings ? "alert" : "check-circle") + "<span>" + e(task.summary) + "</span></div>" +
        '<div class="inspection-card__foot"><span>下次执行：' + (task.nextRun ? util.timeUntil(task.nextRun) : "--") + "</span>" +
          '<button class="btn btn--sm ' + (task.status === "running" ? "btn--secondary" : "btn--primary") + '" type="button" data-action="run-inspection" data-task="' + e(task.id) + '"' +
          (task.status === "running" ? " disabled" : "") + ">" + (task.status === "running" ? "执行中..." : "立即巡检") + "</button></div>" +
      "</article>";
    }).join("");

    return ui.breadcrumb([{ label: "工作台", href: "#/overview" }, { label: "监控运维" }, { label: "巡检任务" }]) +
      ui.pageHead({
        title: "巡检任务",
        subtitle: "在本机执行的自动化巡检与数据完整性检查",
        actions: '<button class="btn btn--secondary" type="button" data-action="export-snapshot">' +
          util.icon("download") + "<span>导出巡检快照</span></button>"
      }) +
      '<div class="kpi-grid kpi-grid--three">' +
        ui.kpiCard({ label: "巡检任务", value: tasks.length, unit: "项", icon: "clipboard", color: "#2563eb", foot: "全部在本机调度" }) +
        ui.kpiCard({ label: "执行成功", value: success, unit: "项", icon: "check-circle", color: "#00a870", foot: "最近 7 天" }) +
        ui.kpiCard({ label: "正在执行", value: running, unit: "项", icon: "refresh", color: running ? "#ff8f1f" : "#86909c", foot: running ? "请等待巡检完成" : "当前无运行任务" }) +
      "</div>" +
      '<div class="inspection-grid">' + cards + "</div>" +
      '<div class="local-note">' + util.icon("info") + "<span>巡检任务仅读取本机模拟数据，不执行远程命令，也不向外发送任何信息。</span></div>";
  };
})(window);
