/*
 * 变压器离线运维控制台 · 通用工具
 */
(function (global) {
  "use strict";

  var Cloud = (global.Cloud = global.Cloud || {});

  var STATUS_META = {
    normal: { label: "运行正常", tone: "success", color: "#00a870" },
    warning: { label: "预警", tone: "warning", color: "#ff8f1f" },
    fault: { label: "故障", tone: "danger", color: "#f53f3f" },
    maintenance: { label: "维护中", tone: "neutral", color: "#86909c" }
  };

  var SEVERITY_META = {
    critical: { label: "严重", tone: "danger", icon: "alert" },
    warning: { label: "警告", tone: "warning", icon: "alert" },
    info: { label: "提示", tone: "info", icon: "info" }
  };

  var METRICS = {
    oilTemp: {
      key: "oilTemp",
      label: "油温",
      fullLabel: "顶层油温",
      unit: "°C",
      icon: "thermometer",
      color: "#f59e0b",
      thresholdKey: "oilAlarm",
      decimals: 1,
      max: 110
    },
    load: {
      key: "load",
      label: "负载率",
      fullLabel: "负载率",
      unit: "%",
      icon: "gauge",
      color: "#2563eb",
      thresholdKey: "loadAlarm",
      decimals: 1,
      max: 110
    },
    vibration: {
      key: "vibration",
      label: "振动",
      fullLabel: "本体振动",
      unit: "mm/s",
      icon: "activity",
      color: "#7c3aed",
      thresholdKey: "vibrationAlarm",
      decimals: 1,
      max: 8
    },
    partialDischarge: {
      key: "partialDischarge",
      label: "局放",
      fullLabel: "局部放电",
      unit: "pC",
      icon: "zap",
      color: "#0ea5e9",
      thresholdKey: "partialDischargeAlarm",
      decimals: 1,
      max: 100
    }
  };

  var THRESHOLD_DEFS = [
    { key: "normalLower", label: "健康度正常下限", shortLabel: "正常下限", unit: "分", min: 50, max: 99, step: 1, decimals: 0 },
    { key: "warningLower", label: "健康度预警下限", shortLabel: "预警下限", unit: "分", min: 10, max: 98, step: 1, decimals: 0 },
    { key: "oilAlarm", label: "油温告警阈值", shortLabel: "油温告警", unit: "°C", min: 60, max: 120, step: 1, decimals: 0 },
    { key: "vibrationAlarm", label: "振动告警阈值", shortLabel: "振动告警", unit: "mm/s", min: 1, max: 10, step: 0.1, decimals: 1 },
    { key: "partialDischargeAlarm", label: "局放告警阈值", shortLabel: "局放告警", unit: "pC", min: 20, max: 100, step: 1, decimals: 0 },
    { key: "loadAlarm", label: "负载告警阈值", shortLabel: "负载告警", unit: "%", min: 60, max: 110, step: 1, decimals: 0 }
  ];

  var STATE_THEME = {
    normal: {
      color: "#00a870",
      soft: "#e8f8f2",
      border: "#b7e8d8",
      dark: "#11b981",
      glow: "rgba(0, 168, 112, .35)"
    },
    warning: {
      color: "#ff8f1f",
      soft: "#fff6e8",
      border: "#ffd8a8",
      dark: "#f59e0b",
      glow: "rgba(255, 143, 31, .35)"
    },
    fault: {
      color: "#f53f3f",
      soft: "#fff0f0",
      border: "#ffc9c9",
      dark: "#ef4444",
      glow: "rgba(245, 63, 63, .35)"
    },
    maintenance: {
      color: "#86909c",
      soft: "#f2f3f5",
      border: "#d9dde3",
      dark: "#64748b",
      glow: "rgba(134, 144, 156, .3)"
    }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, decimals) {
    var factor = Math.pow(10, decimals || 0);
    return Math.round(value * factor) / factor;
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value, decimals) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return number.toFixed(decimals === undefined ? 1 : decimals);
  }

  function formatPercent(value, decimals) {
    return formatNumber(value, decimals === undefined ? 0 : decimals) + "%";
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatTime(timestamp, withSeconds) {
    var date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "--:--";
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + (withSeconds ? ":" + pad(date.getSeconds()) : "");
  }

  function formatDateTime(timestamp, withSeconds) {
    var date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "--";
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " +
      formatTime(date, withSeconds);
  }

  function formatShortDate(timestamp) {
    var date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "--";
    return pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + formatTime(date, false);
  }

  function timeAgo(timestamp) {
    var time = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
    if (!Number.isFinite(time)) return "--";
    var delta = Math.max(0, Date.now() - time);
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;
    if (delta < 30 * 1000) return "刚刚";
    if (delta < minute) return Math.floor(delta / 1000) + " 秒前";
    if (delta < hour) return Math.floor(delta / minute) + " 分钟前";
    if (delta < day) return Math.floor(delta / hour) + " 小时前";
    if (delta < day * 30) return Math.floor(delta / day) + " 天前";
    return formatDateTime(time, false);
  }

  function timeUntil(timestamp) {
    var time = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
    if (!Number.isFinite(time)) return "--";
    var delta = Math.max(0, time - Date.now());
    var minute = 60 * 1000;
    var hour = 60 * minute;
    if (delta < hour) return Math.max(1, Math.ceil(delta / minute)) + " 分钟后";
    if (delta < 24 * hour) return Math.ceil(delta / hour) + " 小时后";
    return Math.ceil(delta / (24 * hour)) + " 天后";
  }

  function icon(name, className) {
    return '<svg class="icon ' + (className || "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function statusMeta(status) {
    return STATUS_META[status] || STATUS_META.maintenance;
  }

  function severityMeta(severity) {
    return SEVERITY_META[severity] || SEVERITY_META.info;
  }

  function metricMeta(key) {
    return METRICS[key] || METRICS.oilTemp;
  }

  function stateTheme(status) {
    return STATE_THEME[status] || STATE_THEME.normal;
  }

  function statusTag(status, options) {
    options = options || {};
    var meta = statusMeta(status);
    return '<span class="status-tag status-tag--' + meta.tone + (options.small ? " status-tag--sm" : "") + '">' +
      '<span class="status-tag__dot"></span>' + escapeHtml(options.label || meta.label) + "</span>";
  }

  function healthTone(health, thresholds) {
    if (health < thresholds.warningLower) return "danger";
    if (health < thresholds.normalLower) return "warning";
    return "success";
  }

  function healthColor(health, thresholds) {
    if (health < thresholds.warningLower) return "#f53f3f";
    if (health < thresholds.normalLower) return "#ff8f1f";
    return "#00a870";
  }

  function clampHealth(value) {
    return clamp(Number(value) || 0, 0, 100);
  }

  function trendArrow(value, suffix) {
    var number = Number(value) || 0;
    var direction = number >= 0 ? "up" : "down";
    var tone = number >= 0 ? "up" : "down";
    return '<span class="trend trend--' + tone + '">' + icon(direction === "up" ? "arrow-up" : "arrow-down") +
      Math.abs(number).toFixed(1) + (suffix || "") + "</span>";
  }

  function seededRandom(seed) {
    var state = seed >>> 0;
    return function () {
      state += 0x6d2b79f5;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(value) {
    var hash = 2166136261;
    var text = String(value);
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function uid(prefix) {
    return (prefix || "ID") + "-" + Date.now().toString(36).toUpperCase() + "-" +
      Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var args = arguments;
      var context = this;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function animateNumber(element, target, decimals, duration) {
    if (!element) return;
    var to = Number(target);
    if (!Number.isFinite(to)) return;
    var from = Number(String(element.textContent).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(from)) from = to;
    var start = performance.now();
    var frameDuration = duration || 520;

    function tick(now) {
      var progress = Math.min(1, (now - start) / frameDuration);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatNumber(from + (to - from) * eased, decimals);
      if (progress < 1) global.requestAnimationFrame(tick);
    }
    global.requestAnimationFrame(tick);
  }

  function downloadText(filename, content, type) {
    try {
      var blob = new Blob([content], { type: type || "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (error) {
      return false;
    }
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var input = document.createElement("textarea");
        input.value = text;
        input.setAttribute("readonly", "readonly");
        input.style.position = "fixed";
        input.style.top = "-1000px";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
        var ok = document.execCommand("copy");
        input.remove();
        if (ok) resolve();
        else reject(new Error("execCommand copy failed"));
      } catch (error) {
        reject(error);
      }
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  Cloud.util = {
    STATUS_META: STATUS_META,
    SEVERITY_META: SEVERITY_META,
    METRICS: METRICS,
    THRESHOLD_DEFS: THRESHOLD_DEFS,
    STATE_THEME: STATE_THEME,
    clamp: clamp,
    round: round,
    escapeHtml: escapeHtml,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    formatShortDate: formatShortDate,
    timeAgo: timeAgo,
    timeUntil: timeUntil,
    icon: icon,
    statusMeta: statusMeta,
    severityMeta: severityMeta,
    metricMeta: metricMeta,
    stateTheme: stateTheme,
    statusTag: statusTag,
    healthTone: healthTone,
    healthColor: healthColor,
    clampHealth: clampHealth,
    trendArrow: trendArrow,
    seededRandom: seededRandom,
    hashString: hashString,
    uid: uid,
    debounce: debounce,
    qs: qs,
    qsa: qsa,
    animateNumber: animateNumber,
    downloadText: downloadText,
    copyText: copyText
  };
})(window);
