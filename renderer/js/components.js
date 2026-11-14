/*
 * 变压器离线运维控制台 · 可复用界面组件
 */
(function (global) {
  "use strict";

  var Cloud = (global.Cloud = global.Cloud || {});
  var util = Cloud.util;

  function e(value) {
    return util.escapeHtml(value);
  }

  function breadcrumb(items) {
    var html = '<nav class="breadcrumb" aria-label="面包屑">';
    items.forEach(function (item, index) {
      if (index > 0) html += '<span class="breadcrumb__sep">/</span>';
      if (item.href) {
        html += '<a href="' + e(item.href) + '">' + e(item.label) + "</a>";
      } else {
        html += '<span class="breadcrumb__current">' + e(item.label) + "</span>";
      }
    });
    return html + "</nav>";
  }

  function pageHead(options) {
    options = options || {};
    var badges = Array.isArray(options.badges)
      ? options.badges.join("")
      : (options.badges || "");
    return '<div class="page-head">' +
      (options.back ? '<a class="back-link" href="' + e(options.back) + '">' + util.icon("chevron-left") + "返回</a>" : "") +
      '<div class="page-head__main">' +
        '<div class="page-head__title-row">' +
          '<h1 class="page-title">' + e(options.title) + "</h1>" +
          (badges ? '<div class="page-head__badges">' + badges + "</div>" : "") +
        "</div>" +
        (options.subtitle ? '<p class="page-subtitle">' + options.subtitle + "</p>" : "") +
      "</div>" +
      (options.actions ? '<div class="page-head__actions">' + options.actions + "</div>" : "") +
    "</div>";
  }

  function button(label, options) {
    options = options || {};
    var classes = ["btn"];
    if (options.variant) classes.push("btn--" + options.variant);
    if (options.size) classes.push("btn--" + options.size);
    if (options.iconOnly) classes.push("btn--icon");
    var attrs = [];
    if (options.id) attrs.push('id="' + e(options.id) + '"');
    if (options.action) attrs.push('data-action="' + e(options.action) + '"');
    if (options.instance) attrs.push('data-instance="' + e(options.instance) + '"');
    if (options.value) attrs.push('data-value="' + e(options.value) + '"');
    if (options.type) attrs.push('type="' + e(options.type) + '"');
    else attrs.push('type="button"');
    if (options.disabled) attrs.push("disabled");
    if (options.title) attrs.push('title="' + e(options.title) + '"');
    if (options.attrs) attrs.push(options.attrs);
    if (options.ariaLabel) attrs.push('aria-label="' + e(options.ariaLabel) + '"');
    return '<button class="' + classes.join(" ") + '" ' + attrs.join(" ") + ">" +
      (options.icon ? util.icon(options.icon) : "") +
      (options.iconOnly ? "" : "<span>" + e(label) + "</span>") +
      (options.suffix || "") +
    "</button>";
  }

  function link(label, href, options) {
    options = options || {};
    return '<a class="link' + (options.muted ? " link--muted" : "") + '" href="' + e(href) + '"' +
      (options.action ? ' data-action="' + e(options.action) + '"' : "") + ">" + e(label) +
      (options.chevron ? util.icon("chevron-right") : "") + "</a>";
  }

  function tag(text, tone, options) {
    options = options || {};
    return '<span class="tag tag--' + e(tone || "neutral") + (options.outline ? " tag--outline" : "") + '">' +
      (options.dot ? '<span class="tag__dot"></span>' : "") + e(text) + "</span>";
  }

  function statusTag(status, options) {
    options = options || {};
    return util.statusTag(status, options);
  }

  function severityTag(severity) {
    var meta = util.severityMeta(severity);
    return '<span class="severity severity--' + meta.tone + '">' +
      util.icon(meta.icon) + e(meta.label) + "</span>";
  }

  function healthBar(health, thresholds, options) {
    options = options || {};
    var tone = util.healthTone(health, thresholds);
    var color = util.healthColor(health, thresholds);
    return '<div class="health-cell ' + (options.small ? "health-cell--sm" : "") + '">' +
      '<span class="health-cell__value">' + util.formatNumber(health, 1) + "</span>" +
      '<span class="health-cell__bar"><i style="width:' + util.clamp(health, 0, 100).toFixed(1) + "%;background:" + color + '"></i></span>' +
      (options.hideLabel ? "" : '<span class="health-cell__tone health-cell__tone--' + tone + '">' + (tone === "success" ? "良好" : tone === "warning" ? "关注" : "异常") + "</span>") +
    "</div>";
  }

  function scoreRing(health, status, options) {
    options = options || {};
    var size = options.size || 112;
    var stroke = options.stroke || 8;
    var radius = 50;
    var circumference = 2 * Math.PI * radius;
    var clamped = util.clamp(health, 0, 100);
    var offset = circumference - (clamped / 100) * circumference;
    var color = options.color || util.stateTheme(status).color;
    return '<div class="score-ring" style="width:' + size + "px;height:" + size + 'px">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<circle class="score-ring__track" cx="60" cy="60" r="' + radius + '" fill="none" stroke-width="' + stroke + '"/>' +
        '<circle class="score-ring__progress" cx="60" cy="60" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
        '<circle class="score-ring__inner" cx="60" cy="60" r="43" fill="none"/>' +
      "</svg>" +
      '<div class="score-ring__center"><strong style="color:' + color + '">' + util.formatNumber(health, 1) + "</strong>" +
      '<span>' + e(options.label || "健康度") + "</span></div></div>";
  }

  function sparkline(values, color, options) {
    options = options || {};
    var data = (values || []).filter(function (value) { return Number.isFinite(Number(value)); });
    if (data.length < 2) return '<span class="sparkline sparkline--empty"></span>';
    var width = 120;
    var height = 34;
    var min = Math.min.apply(null, data);
    var max = Math.max.apply(null, data);
    var range = max - min || 1;
    var points = data.map(function (value, index) {
      var x = (index / (data.length - 1)) * width;
      var y = height - 3 - ((value - min) / range) * (height - 6);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    var line = points.join(" ");
    var fill = "0," + height + " " + line + " " + width + "," + height;
    var gradientId = "sg-" + Math.random().toString(36).slice(2, 8);
    return '<svg class="sparkline" viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity=".22"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      '<polygon points="' + fill + '" fill="url(#' + gradientId + ')"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>' +
    "</svg>";
  }

  function donut(segments, options) {
    options = options || {};
    var total = segments.reduce(function (sum, segment) { return sum + Number(segment.value || 0); }, 0);
    var radius = 50;
    var circumference = 2 * Math.PI * radius;
    var offset = 0;
    var html = '<div class="donut" style="width:' + (options.size || 132) + "px;height:" + (options.size || 132) + 'px">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="' + radius + '" fill="none" stroke="#f2f4f7" stroke-width="10"/>';
    segments.forEach(function (segment) {
      var value = Number(segment.value || 0);
      var length = total ? (value / total) * circumference : 0;
      if (!length) return;
      html += '<circle cx="60" cy="60" r="' + radius + '" fill="none" stroke="' + segment.color + '" stroke-width="10" ' +
        'stroke-linecap="butt" stroke-dasharray="' + Math.max(0, length - 2).toFixed(2) + " " + (circumference - Math.max(0, length - 2)).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
      offset += length;
    });
    html += "</svg>" +
      '<div class="donut__center"><strong>' + (options.total !== undefined ? options.total : total) + "</strong>" +
      "<span>" + e(options.centerLabel || "实例") + "</span></div></div>";
    return html;
  }

  function kpiCard(options) {
    options = options || {};
    return '<article class="kpi-card' + (options.className ? " " + options.className : "") + '">' +
      '<div class="kpi-card__top">' +
        '<span class="kpi-card__label">' + e(options.label) + "</span>" +
        (options.icon ? '<span class="kpi-card__icon" style="--tone:' + (options.color || "#2563eb") + '">' + util.icon(options.icon) + "</span>" : "") +
      "</div>" +
      '<div class="kpi-card__value-row"><strong class="kpi-card__value">' + options.value + "</strong>" +
      (options.unit ? '<span class="kpi-card__unit">' + e(options.unit) + "</span>" : "") + "</div>" +
      '<div class="kpi-card__foot">' + (options.foot || "") + "</div>" +
      (options.spark ? '<div class="kpi-card__spark">' + options.spark + "</div>" : "") +
    "</article>";
  }

  function iconBadge(name, color) {
    return '<span class="icon-badge" style="--tone:' + color + '">' + util.icon(name) + "</span>";
  }

  function emptyState(title, description, iconName) {
    return '<div class="empty-state">' +
      '<span class="empty-state__icon">' + util.icon(iconName || "info") + "</span>" +
      "<strong>" + e(title) + "</strong>" +
      "<p>" + e(description || "") + "</p>" +
    "</div>";
  }

  function alertBanner(options) {
    options = options || {};
    return '<div class="alert-banner alert-banner--' + e(options.tone || "warning") + '">' +
      '<span class="alert-banner__icon">' + util.icon(options.icon || "alert") + "</span>" +
      '<div class="alert-banner__content"><strong>' + e(options.title) + "</strong>" +
      (options.description ? "<p>" + e(options.description) + "</p>" : "") + "</div>" +
      (options.action || "") +
    "</div>";
  }

  function pageTab(label, href, active, count) {
    return '<a class="page-tab' + (active ? " is-active" : "") + '" href="' + e(href) + '">' + e(label) +
      (count ? '<span class="page-tab__count">' + count + "</span>" : "") + "</a>";
  }

  function fieldValue(label, value, className) {
    return '<div class="field-value ' + (className || "") + '"><span>' + e(label) + "</span><strong>" +
      (typeof value === "string" && value.indexOf("<") === 0 ? value : e(value)) + "</strong></div>";
  }

  function switchControl(id, checked, label) {
    return '<label class="switch" for="' + e(id) + '">' +
      '<input id="' + e(id) + '" type="checkbox" role="switch"' + (checked ? " checked" : "") + ">" +
      '<span class="switch__track"><span class="switch__thumb"></span></span>' +
      (label ? '<span class="switch__label">' + e(label) + "</span>" : "") +
    "</label>";
  }

  function segmented(options, active, config) {
    config = typeof config === "string" ? { attribute: config } : (config || {});
    var attr = config.attribute || "data-range";
    var items = Array.isArray(options) ? options : (options.items || []);
    var group = (!Array.isArray(options) && options.group) || config.group;
    var ariaLabel = (!Array.isArray(options) && options.ariaLabel) || "范围选择";
    return '<div class="segmented"' + (group ? ' data-range-group="' + e(group) + '"' : "") +
      ' role="group" aria-label="' + e(ariaLabel) + '">' +
      items.map(function (item) {
        return '<button class="segmented__item' + (item.value === active ? " is-active" : "") + '" type="button" ' +
          attr + '="' + e(item.value) + '">' + e(item.label) + "</button>";
      }).join("") + "</div>";
  }

  function thresholdPill(label, value, unit, tone) {
    return '<span class="threshold-pill' + (tone ? " threshold-pill--" + tone : "") + '">' +
      '<span>' + e(label) + "</span><b>" + e(value) + (unit ? " " + e(unit) : "") + "</b></span>";
  }

  function timeCell(timestamp) {
    return '<span class="time-cell" title="' + e(util.formatDateTime(timestamp, true)) + '">' +
      util.formatShortDate(timestamp) + "</span>";
  }

  function trend(value, unit, options) {
    options = options || {};
    var number = Number(value) || 0;
    var direction = number > 0 ? "up" : number < 0 ? "down" : "flat";
    var good = options.inverse ? direction === "down" : direction === "up";
    var tone = direction === "flat" ? "muted" : good ? "success" : "danger";
    return '<span class="trend-mini trend-mini--' + tone + '">' +
      (direction === "up" ? util.icon("arrow-up") : direction === "down" ? util.icon("arrow-down") : "") +
      (direction === "flat" ? "持平" : Math.abs(number).toFixed(1) + e(unit || "")) + "</span>";
  }

  Cloud.ui = {
    breadcrumb: breadcrumb,
    pageHead: pageHead,
    button: button,
    link: link,
    tag: tag,
    statusTag: statusTag,
    severityTag: severityTag,
    healthBar: healthBar,
    scoreRing: scoreRing,
    sparkline: sparkline,
    donut: donut,
    kpiCard: kpiCard,
    iconBadge: iconBadge,
    emptyState: emptyState,
    alertBanner: alertBanner,
    pageTab: pageTab,
    fieldValue: fieldValue,
    switchControl: switchControl,
    segmented: segmented,
    thresholdPill: thresholdPill,
    timeCell: timeCell,
    trend: trend
  };
})(window);
