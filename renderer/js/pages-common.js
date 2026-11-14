/*
 * 页面公共组件与共享状态
 */
(function (global) {
  "use strict";

  var Cloud = (global.Cloud = global.Cloud || {});
  var util = Cloud.util;
  var ui = Cloud.ui;
  var data = Cloud.data;

  var filters = {
    instancesSearch: "",
    instancesStatus: "all",
    instancesLocation: "all",
    alarmSearch: "",
    alarmSeverity: "all",
    alarmStatus: "all",
    instanceAlarmSearch: "",
    instanceAlarmSeverity: "all",
    instanceAlarmStatus: "all",
    detailRange: "live",
    monitorRange: "live",
    healthRange: "30m",
    historyInstanceId: "TR-220-001",
    historyMetric: "health",
    historyRange: "24h"
  };

  function e(value) {
    return util.escapeHtml(value);
  }

  function getField(instance, path) {
    var parts = path.split(".");
    var current = instance;
    for (var i = 0; i < parts.length; i += 1) {
      if (current === undefined || current === null) return "";
      current = current[parts[i]];
    }
    return current === undefined || current === null ? "" : current;
  }

  function liveNumber(instance, field, decimals, className) {
    var value = getField(instance, field);
    var formatted = Number.isFinite(Number(value)) ? util.formatNumber(value, decimals) : e(value);
    return '<span class="live-number ' + (className || "") + '" data-live-number data-instance="' + e(instance.id) +
      '" data-field="' + e(field) + '" data-decimals="' + (decimals === undefined ? 1 : decimals) + '">' +
      formatted + "</span>";
  }

  function liveStatus(instance) {
    return '<span class="live-status" data-live-status data-instance="' + e(instance.id) + '">' +
      ui.statusTag(instance.status) + "</span>";
  }

  function liveHealthBar(instance, options) {
    return '<span class="live-health" data-live-health data-instance="' + e(instance.id) + '">' +
      ui.healthBar(instance.health, instance.thresholds, options) + "</span>";
  }

  function liveHealthCell(instance) {
    return '<div class="health-cell" data-live-health-cell data-instance="' + e(instance.id) + '">' +
      '<span class="health-cell__value">' + util.formatNumber(instance.health, 1) + "</span>" +
      '<span class="health-cell__bar"><i style="width:' + util.clamp(instance.health, 0, 100).toFixed(1) + "%;background:" +
      util.healthColor(instance.health, instance.thresholds) + '"></i></span>' +
    "</div>";
  }

  function liveRing(instance, size) {
    return '<span class="live-ring" data-live-ring data-instance="' + e(instance.id) + '" data-size="' +
      (size || 108) + '">' + ui.scoreRing(instance.health, instance.status, { size: size || 108 }) + "</span>";
  }

  function liveUpdated(instance) {
    return '<span data-live-updated data-instance="' + e(instance.id) + '">' + util.timeAgo(instance.lastUpdated) + "</span>";
  }

  function instanceHref(instance, tab) {
    return "#/instances/" + encodeURIComponent(instance.id) + "/" + (tab || "overview");
  }

  function instanceIcon(instance, size) {
    var status = util.stateTheme(instance.status);
    return '<span class="instance-icon" style="--tone:' + status.color + ';--soft:' + status.soft + ";--border:" + status.border +
      (size ? ";width:" + size + "px;height:" + size + "px" : "") + '">' + util.icon("server") + "</span>";
  }

  function card(options) {
    options = options || {};
    return '<section class="card ' + (options.className || "") + '">' +
      (options.title ? '<div class="card-head ' + (options.headClass || "") + '">' +
        '<div class="card-head__title">' +
          '<h2>' + options.title + "</h2>" +
          (options.description ? '<p>' + options.description + "</p>" : "") +
        "</div>" +
        '<div class="card-head__extra">' + (options.extra || "") + "</div>" +
      "</div>" : "") +
      '<div class="card-body ' + (options.bodyClass || "") + '">' + (options.body || "") + "</div>" +
    "</section>";
  }

  function pageActions(instance) {
    return '<button class="btn btn--secondary" type="button" data-action="refresh-data">' +
      util.icon("refresh") + "<span>刷新数据</span></button>" +
      (instance
        ? '<button class="btn btn--primary" type="button" data-action="open-sim" data-instance="' + e(instance.id) + '">' +
          util.icon("sliders") + "<span>模拟控制</span></button>"
        : '<button class="btn btn--primary" type="button" data-action="open-sim" data-instance="TR-220-001">' +
          util.icon("sliders") + "<span>模拟数据控制</span></button>");
  }

  function detailTabs(instance, active) {
    var openAlarms = data.getAlarmCounts(instance.id).open;
    var tabs = [
      { key: "overview", label: "概览" },
      { key: "monitor", label: "实时监控" },
      { key: "health", label: "健康分析" },
      { key: "alarms", label: "告警记录", count: openAlarms },
      { key: "config", label: "配置诊断" }
    ];
    return '<div class="page-tabs" role="tablist">' + tabs.map(function (tab) {
      return '<a class="page-tab' + (tab.key === active ? " is-active" : "") + '" role="tab" aria-selected="' +
        (tab.key === active) + '" href="' + instanceHref(instance, tab.key) + '">' + tab.label +
        (tab.count ? '<span class="page-tab__count">' + tab.count + "</span>" : "") + "</a>";
    }).join("") + "</div>";
  }

  function detailHeader(instance, active) {
    var crumbs = ui.breadcrumb([
      { label: "工作台", href: "#/overview" },
      { label: "变压器实例", href: "#/instances" },
      { label: instance.name }
    ]);
    var titleBadges = liveStatus(instance) +
      '<span class="tag tag--neutral">' + e(instance.voltage) + "</span>" +
      '<span class="tag tag--neutral">' + e(instance.capacity) + "</span>";
    var head = ui.pageHead({
      title: instance.name,
      subtitle: '<span class="mono">' + e(instance.id) + "</span>" +
        '<span class="subtitle-sep">·</span>' + e(instance.location) +
        '<span class="subtitle-sep">·</span>' + e(instance.zone),
      badges: titleBadges,
      actions: pageActions(instance)
    });
    return crumbs + head + detailTabs(instance, active);
  }

  function metricCard(instance, key, options) {
    options = options || {};
    var meta = util.metricMeta(key);
    var value = instance.metrics[key];
    var threshold = instance.thresholds[meta.thresholdKey];
    var history = instance.history.slice(-28).map(function (point) { return point[key]; });
    var delta = instance.deltas[key];
    var alarm = Number(value) >= threshold;
    return '<article class="metric-card" style="--metric:' + meta.color + '">' +
      '<div class="metric-card__head">' +
        '<span class="metric-card__icon">' + util.icon(meta.icon) + "</span>" +
        '<span class="metric-card__label">' + e(meta.fullLabel) + "</span>" +
        (alarm ? '<span class="metric-card__alarm">超阈值</span>' : "") +
      "</div>" +
      '<div class="metric-card__value">' + liveNumber(instance, "metrics." + key, 1) +
        '<small>' + e(meta.unit) + "</small></div>" +
      '<div class="metric-card__foot">' +
        ui.trend(delta, " " + meta.unit, { inverse: key === "oilTemp" || key === "vibration" || key === "partialDischarge" }) +
        '<span class="metric-card__threshold">阈值 ' + e(threshold) + " " + e(meta.unit) + "</span>" +
      "</div>" +
      '<div class="metric-card__spark">' + ui.sparkline(history, meta.color) + "</div>" +
    "</article>";
  }

  function healthKpi(instance) {
    var color = util.healthColor(instance.health, instance.thresholds);
    var history = instance.history.slice(-28).map(function (point) { return point.health; });
    return '<article class="metric-card metric-card--health" style="--metric:' + color + '">' +
      '<div class="metric-card__head">' +
        '<span class="metric-card__icon">' + util.icon("heart") + "</span>" +
        '<span class="metric-card__label">综合健康度</span>' +
        '<span class="metric-card__alarm metric-card__alarm--calm">' + liveStatus(instance) + "</span>" +
      "</div>" +
      '<div class="metric-card__value">' + liveNumber(instance, "health", 1) + "<small>分</small></div>" +
      '<div class="metric-card__foot"><span class="muted">正常下限 ' + instance.thresholds.normalLower + " 分</span>" +
        '<span class="metric-card__threshold">剩余寿命 ' + liveNumber(instance, "remainingLifeDays", 0) + " 天</span></div>" +
      '<div class="metric-card__spark">' + ui.sparkline(history, color) + "</div>" +
    "</article>";
  }

  function alarmItem(alarm, showInstance) {
    var instance = data.getInstance(alarm.instanceId);
    var meta = util.severityMeta(alarm.severity);
    return '<a class="alarm-item alarm-item--' + meta.tone + '" href="' +
      (instance ? instanceHref(instance, "alarms") : "#/alarms") + '">' +
      '<span class="alarm-item__dot"></span>' +
      '<div class="alarm-item__body">' +
        '<div class="alarm-item__title"><strong>' + e(alarm.category) + "</strong>" + ui.severityTag(alarm.severity) + "</div>" +
        '<p>' + (showInstance && instance ? e(instance.name) + " · " : "") + e(alarm.message) + "</p>" +
        '<span class="alarm-item__time">' + util.timeAgo(alarm.createdAt) + (alarm.status === "acknowledged" ? " · 已确认" : "") + "</span>" +
      "</div>" +
    "</a>";
  }

  function deviceSvg(instance) {
    var theme = util.stateTheme(instance.status);
    var color = theme.color;
    return '<div class="device-visual" style="--machine:' + color + ";--machine-soft:" + theme.soft + ";--machine-glow:" + theme.glow + '">' +
      '<div class="device-grid"></div>' +
      '<div class="device-scan"></div>' +
      '<svg class="device-svg" viewBox="0 0 460 430" role="img" aria-label="' + e(instance.name) + ' 设备拓扑示意">' +
        "<defs>" +
          '<linearGradient id="tankFill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0a2030"/><stop offset="1" stop-color="#06131e"/>' +
          "</linearGradient>" +
          '<linearGradient id="bushingFill" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#edfaff"/><stop offset=".45" stop-color="#c9eef8"/><stop offset="1" stop-color="#7bb8c8"/>' +
          "</linearGradient>" +
          '<filter id="deviceGlow" x="-60%" y="-60%" width="220%" height="220%">' +
            '<feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          "</filter>" +
        "</defs>" +
        '<ellipse cx="230" cy="392" rx="150" ry="25" fill="' + color + '" opacity=".1" filter="url(#deviceGlow)"/>' +
        '<g fill="none" stroke="' + color + '" stroke-linecap="round" stroke-linejoin="round">' +
          '<g opacity=".7" stroke-width="5">' +
            '<path d="M112 168V292"/><path d="M128 158V302"/><path d="M144 168V292"/>' +
            '<path d="M316 168V292"/><path d="M332 158V302"/><path d="M348 168V292"/>' +
          "</g>" +
          '<g opacity=".22" stroke-width="12"><path d="M128 158V302"/><path d="M332 158V302"/></g>' +
          '<path d="M108 174H150M108 292H150M310 174H352M310 292H352" opacity=".45"/>' +
          '<rect x="158" y="150" width="144" height="186" rx="12" fill="url(#tankFill)" stroke="' + color + '" stroke-width="1.8"/>' +
          '<path d="M159 154h142" opacity=".5"/>' +
          '<path d="M159 182h142" opacity=".17"/>' +
          '<path d="M159 305h142" opacity=".24"/>' +
          '<g opacity=".1" stroke-width="1">' +
            '<path d="M189 205v92M210 205v92M230 205v92M250 205v92M271 205v92"/>' +
            '<circle cx="230" cy="251" r="30"/><circle cx="230" cy="251" r="44"/>' +
          "</g>" +
          '<rect x="163" y="176" width="36" height="12" rx="2" fill="#071925" stroke="' + color + '" stroke-opacity=".25"/>' +
          '<path d="M168 181h19M168 185h14" opacity=".25"/>' +
          '<g fill="url(#bushingFill)" stroke="' + color + '" stroke-width="1.2">' +
            '<rect x="181" y="68" width="17" height="103" rx="8.5"/>' +
            '<rect x="221" y="54" width="17" height="117" rx="8.5"/>' +
            '<rect x="261" y="68" width="17" height="103" rx="8.5"/>' +
          "</g>" +
          '<g fill="#ffffff" opacity=".72">' +
            '<rect x="184" y="72" width="4" height="94" rx="2"/>' +
            '<rect x="224" y="58" width="4" height="108" rx="2"/>' +
            '<rect x="264" y="72" width="4" height="94" rx="2"/>' +
          "</g>" +
          '<g opacity=".65">' +
            '<path d="M178 76h23M178 86h23M178 96h23M218 62h23M218 72h23M218 82h23M258 76h23M258 86h23M258 96h23"/>' +
          "</g>" +
          '<g fill="#e9fbff" stroke="none" opacity=".86">' +
            '<ellipse cx="189.5" cy="68" rx="8.5" ry="2.4"/><ellipse cx="229.5" cy="54" rx="8.5" ry="2.4"/><ellipse cx="269.5" cy="68" rx="8.5" ry="2.4"/>' +
          "</g>" +
          '<path d="M188 320v11M272 320v11M200 330h61" stroke-width="1" opacity=".4"/>' +
          '<circle cx="230" cy="352" r="17" fill="' + color + '" opacity=".08"/>' +
          '<circle cx="230" cy="352" r="10" fill="none" stroke-width="1.3" opacity=".75"/>' +
          '<circle cx="230" cy="352" r="4" fill="' + color + '" filter="url(#deviceGlow)"/>' +
        "</g>" +
        '<g fill="' + color + '">' +
          '<circle cx="86" cy="228" r="1.8" opacity=".5"/><circle cx="376" cy="206" r="1.3" opacity=".42"/>' +
          '<circle cx="388" cy="322" r="1.5" opacity=".46"/><circle cx="74" cy="330" r="1.1" opacity=".34"/>' +
        "</g>" +
      "</svg>" +
      '<div class="device-hud device-hud--top">' +
        '<span><i class="hud-dot"></i>LOCAL MONITOR</span>' +
        '<span>' + e(instance.voltage) + " / " + e(instance.capacity) + "</span>" +
      "</div>" +
      '<div class="device-hud device-hud--bottom">' +
        '<span>' + e(instance.collector) + "</span>" +
        '<span>' + liveUpdated(instance) + " 更新</span>" +
      "</div>" +
    "</div>";
  }

  function diagnosisText(instance) {
    if (instance.status === "fault") return "健康度严重偏低，存在绝缘与机械风险，建议立即安排现场检查。";
    if (instance.status === "warning") return "健康度处于预警区间，建议重点关注温升、振动与局放趋势。";
    if (instance.status === "maintenance") return "设备处于检修状态，在线模拟数据已暂停，完成检修后请恢复监测。";
    return "设备运行平稳，关键指标均处于健康区间，建议保持当前运行工况。";
  }

  function recommendations(instance) {
    if (instance.status === "fault") {
      return [
        "立即复核顶层油温与局放趋势，确认是否存在持续上升。",
        "安排停电检修，重点检查绕组紧固、绝缘油色谱与冷却系统。",
        "在完成检修前降低负载，避免高温与高振动叠加。"
      ];
    }
    if (instance.status === "warning") {
      return [
        "检查冷却风机与散热器效率，确认油温上升是否由散热不足引起。",
        "关注振动趋势，必要时安排本体紧固与基础检查。",
        "将采样间隔缩短至 1 秒，持续观察 24 小时。"
      ];
    }
    if (instance.status === "maintenance") {
      return [
        "完成检修后重新执行本地基线校准。",
        "确认采集通道恢复在线后再启用自动模拟。",
        "检修完成后执行一次全量健康评估。"
      ];
    }
    return [
      "保持当前负载与冷却策略，按既定周期巡检。",
      "持续关注油温、局放与振动的周环比变化。",
      "下次例行检修前完成一次历史数据回顾。"
    ];
  }

  function thresholdInputs(thresholds, scope) {
    return util.THRESHOLD_DEFS.map(function (def) {
      return '<label class="form-field">' +
        '<span class="form-field__label">' + e(def.label) + "</span>" +
        '<span class="input-with-unit">' +
          '<input type="number" data-' + scope + '-threshold="' + e(def.key) + '" value="' +
          util.formatNumber(thresholds[def.key], def.decimals) + '" min="' + def.min + '" max="' + def.max + '" step="' + def.step + '">' +
          '<em>' + e(def.unit) + "</em>" +
        "</span>" +
      "</label>";
    }).join("");
  }

  function resolveSeriesStats(series) {
    var values = series.values || [];
    if (!values.length) return { min: 0, max: 0, avg: 0, latest: 0 };
    return {
      min: Math.min.apply(null, values),
      max: Math.max.apply(null, values),
      avg: values.reduce(function (sum, value) { return sum + value; }, 0) / values.length,
      latest: values[values.length - 1]
    };
  }

  Cloud.pages = Cloud.pages || {};
  Cloud.pages.filters = filters;
  Cloud.pages.helpers = {
    e: e,
    getField: getField,
    liveNumber: liveNumber,
    liveStatus: liveStatus,
    liveHealthBar: liveHealthBar,
    liveHealthCell: liveHealthCell,
    liveRing: liveRing,
    liveUpdated: liveUpdated,
    instanceHref: instanceHref,
    instanceIcon: instanceIcon,
    card: card,
    pageActions: pageActions,
    detailTabs: detailTabs,
    detailHeader: detailHeader,
    metricCard: metricCard,
    healthKpi: healthKpi,
    alarmItem: alarmItem,
    deviceSvg: deviceSvg,
    diagnosisText: diagnosisText,
    recommendations: recommendations,
    thresholdInputs: thresholdInputs,
    resolveSeriesStats: resolveSeriesStats
  };
})(window);
