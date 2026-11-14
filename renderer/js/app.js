/*
 * 变压器离线运维控制台 · 路由与交互
 */
(function (global) {
  "use strict";

  var Cloud = global.Cloud;
  var util = Cloud.util;
  var ui = Cloud.ui;
  var data = Cloud.data;
  var pages = Cloud.pages;
  var h = pages.helpers;
  var filters = pages.filters;

  var PAGE_TITLES = {
    overview: "运维总览",
    instances: "变压器实例",
    alarms: "告警中心",
    nodes: "采集节点",
    inspections: "巡检任务",
    health: "健康评估",
    history: "历史趋势",
    strategies: "阈值策略",
    settings: "离线设置",
    notFound: "页面不存在"
  };

  var TAB_TITLES = {
    overview: "概览",
    monitor: "实时监控",
    health: "健康分析",
    alarms: "告警记录",
    config: "配置诊断"
  };

  var NAV_FOR_ROUTE = {
    overview: "overview",
    instances: "instances",
    instance: "instances",
    alarms: "alarms",
    nodes: "nodes",
    inspections: "inspections",
    health: "health",
    history: "history",
    strategies: "strategies",
    settings: "settings"
  };

  var state = {
    route: null,
    charts: [],
    statusSnapshot: {},
    drawerInstanceId: null,
    commandItems: [],
    commandIndex: 0,
    pendingConfirm: null,
    scheduledRender: null,
    pageNeedsRefresh: false
  };

  var elements = {
    page: document.getElementById("page"),
    sidebar: document.getElementById("sidebar"),
    bellButton: document.getElementById("bellButton"),
    bellBadge: document.getElementById("bellBadge"),
    notificationPopover: document.getElementById("notificationPopover"),
    notificationList: document.getElementById("notificationList"),
    markAllRead: document.getElementById("markAllRead"),
    searchTrigger: document.getElementById("searchTrigger"),
    commandOverlay: document.getElementById("commandOverlay"),
    commandInput: document.getElementById("commandInput"),
    commandResults: document.getElementById("commandResults"),
    drawerOverlay: document.getElementById("drawerOverlay"),
    drawer: document.getElementById("drawer"),
    drawerBody: document.getElementById("drawerBody"),
    drawerTitle: document.getElementById("drawerTitle"),
    drawerSubtitle: document.getElementById("drawerSubtitle"),
    drawerClose: document.getElementById("drawerClose"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalFoot: document.getElementById("modalFoot"),
    modalClose: document.getElementById("modalClose"),
    toastHost: document.getElementById("toastHost"),
    simStatus: document.getElementById("simStatus"),
    simStatusDetail: document.getElementById("simStatusDetail"),
    navInstanceCount: document.getElementById("navInstanceCount"),
    navAlarmCount: document.getElementById("navAlarmCount"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    collapseButton: document.getElementById("collapseButton"),
    helpButton: document.getElementById("helpButton")
  };

  function e(value) {
    return util.escapeHtml(value);
  }

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function isTyping() {
    var el = document.activeElement;
    if (!el) return false;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
  }

  function isOverlayOpen() {
    return !elements.drawerOverlay.hidden || !elements.commandOverlay.hidden || !elements.modalOverlay.hidden;
  }

  /* ------------------------------------------------------------------------
   * 路由
   * --------------------------------------------------------------------- */

  function parseRoute() {
    var raw = String(global.location.hash || "").replace(/^#\/?/, "").replace(/\/+$/, "");
    if (!raw) return { name: "overview" };
    var parts;
    try {
      parts = raw.split("/").map(function (part) { return decodeURIComponent(part); });
    } catch (error) {
      parts = raw.split("/");
    }

    if (parts[0] === "instances") {
      if (parts[1]) {
        var tab = parts[2] || "overview";
        if (!TAB_TITLES[tab]) tab = "overview";
        return { name: "instance", instanceId: parts[1], tab: tab };
      }
      return { name: "instances" };
    }
    if (PAGE_TITLES[parts[0]] !== undefined && parts[0] !== "notFound") {
      return { name: parts[0] };
    }
    return { name: "notFound" };
  }

  function navigate(href) {
    if (!href) return;
    if (href.indexOf("#") !== 0) {
      global.location.hash = href;
      return;
    }
    if (global.location.hash === href) {
      renderRoute({ preserveScroll: false });
      closeCommand();
      return;
    }
    global.location.hash = href;
    closeCommand();
  }

  function pageRenderer(route) {
    switch (route.name) {
      case "overview": return pages.overview;
      case "instances": return pages.instances;
      case "instance": return function (r) { return pages.instance(r); };
      case "alarms": return pages.alarms;
      case "nodes": return pages.nodes;
      case "inspections": return pages.inspections;
      case "health": return pages.health;
      case "history": return pages.history;
      case "strategies": return pages.strategies;
      case "settings": return pages.settings;
      default: return pages.notFound;
    }
  }

  function pageTitleFor(route) {
    if (route.name === "instance") {
      var instance = data.getInstance(route.instanceId);
      return (instance ? instance.name + " · " : "") + (TAB_TITLES[route.tab] || "概览");
    }
    return PAGE_TITLES[route.name] || "变压器离线运维控制台";
  }

  function renderRoute(options) {
    options = options || {};
    var route = parseRoute();
    state.route = route;

    closeNotifications();
    if (!options.preserveScroll) {
      global.scrollTo(0, 0);
    }

    destroyCharts();

    var renderer = pageRenderer(route);
    var html;
    try {
      html = renderer(route);
    } catch (error) {
      console.error("[offline-console] render error", error);
      html = pages.notFound();
    }
    elements.page.innerHTML = html;

    updateNavigation(route);
    document.title = pageTitleFor(route) + " · 变压器离线运维控制台";

    applyAllFilters();
    syncAutoRefreshControls();
    syncIntervalControls();
    updateSidebarStatus();
    updateCounters();
    updateLiveValues();
    mountCharts(route);
    state.statusSnapshot = buildStatusSnapshot();
    state.pageNeedsRefresh = false;
  }

  function mountCharts(route) {
    destroyCharts();
    try {
      state.charts = pages.mount(route) || [];
    } catch (error) {
      console.error("[offline-console] chart mount error", error);
      state.charts = [];
    }
    // 让浏览器完成一次布局后再校准尺寸，避免 Canvas 宽度为 0。
    global.requestAnimationFrame(function () {
      state.charts.forEach(function (item) {
        if (item.chart && typeof item.chart.resize === "function") item.chart.resize();
      });
    });
  }

  function destroyCharts() {
    state.charts.forEach(function (item) {
      try {
        if (item.chart && typeof item.chart.destroy === "function") item.chart.destroy();
      } catch (error) {
        /* ignore */
      }
    });
    state.charts = [];
  }

  function updateNavigation(route) {
    var activeName = NAV_FOR_ROUTE[route.name] || null;
    qsa(".nav-item").forEach(function (item) {
      var isActive = item.getAttribute("data-nav") === activeName;
      item.classList.toggle("is-active", isActive);
      if (isActive) {
        var group = item.closest(".nav-group");
        if (group) {
          group.classList.add("is-open");
          var head = group.querySelector(".nav-group__head");
          if (head) head.setAttribute("aria-expanded", "true");
        }
      }
    });

    var count = data.getAlarmCounts().open;
    if (elements.navAlarmCount) {
      elements.navAlarmCount.textContent = count;
      elements.navAlarmCount.hidden = count === 0;
    }
    if (elements.navInstanceCount) {
      elements.navInstanceCount.textContent = data.instances.length;
    }
  }

  /* ------------------------------------------------------------------------
   * 实时数值刷新
   * --------------------------------------------------------------------- */

  function buildStatusSnapshot() {
    var snapshot = {};
    data.instances.forEach(function (instance) {
      snapshot[instance.id] = instance.status;
    });
    return snapshot;
  }

  function statusesChanged(previous) {
    return data.instances.some(function (instance) {
      return previous[instance.id] !== instance.status;
    });
  }

  function resolveField(instance, field) {
    if (!instance) return null;
    var parts = field.split(".");
    var value = instance;
    for (var i = 0; i < parts.length; i += 1) {
      if (value === null || value === undefined) return null;
      value = value[parts[i]];
    }
    return value;
  }

  function updateLiveValues() {
    qsa("[data-live-number]").forEach(function (element) {
      var instance = data.getInstance(element.getAttribute("data-instance"));
      if (!instance) return;
      var value = resolveField(instance, element.getAttribute("data-field"));
      var decimals = Number(element.getAttribute("data-decimals"));
      if (!Number.isFinite(Number(value))) return;
      element.textContent = util.formatNumber(value, Number.isFinite(decimals) ? decimals : 1);
    });

    qsa("[data-live-status]").forEach(function (element) {
      var instance = data.getInstance(element.getAttribute("data-instance"));
      if (instance) element.innerHTML = ui.statusTag(instance.status);
    });

    qsa("[data-live-health]").forEach(function (element) {
      var instance = data.getInstance(element.getAttribute("data-instance"));
      if (instance) element.innerHTML = ui.healthBar(instance.health, instance.thresholds);
    });

    qsa("[data-live-health-cell]").forEach(function (element) {
      var instance = data.getInstance(element.getAttribute("data-instance"));
      if (!instance) return;
      element.innerHTML = '<span class="health-cell__value">' + util.formatNumber(instance.health, 1) + "</span>" +
        '<span class="health-cell__bar"><i style="width:' + util.clamp(instance.health, 0, 100).toFixed(1) +
        "%;background:" + util.healthColor(instance.health, instance.thresholds) + '"></i></span>';
    });

    qsa("[data-live-ring]").forEach(function (element) {
      var instance = data.getInstance(element.getAttribute("data-instance"));
      if (!instance) return;
      var size = Number(element.getAttribute("data-size")) || 108;
      element.innerHTML = ui.scoreRing(instance.health, instance.status, { size: size });
    });

    qsa("[data-live-updated]").forEach(function (element) {
      var instance = data.getInstance(element.getAttribute("data-instance"));
      if (instance) element.textContent = util.timeAgo(instance.lastUpdated);
    });

    var stats = data.getStats();
    qsa('[data-live-kpi="averageHealth"]').forEach(function (element) {
      element.textContent = util.formatNumber(stats.averageHealth, 1);
    });
    qsa('[data-live-kpi="openAlarms"]').forEach(function (element) {
      element.textContent = stats.openAlarms;
    });
    qsa('[data-live-kpi="simText"]').forEach(function (element) {
      element.textContent = data.settings.autoRefresh ? "每 " + data.settings.intervalMs / 1000 + " 秒自动采样" : "自动采样已暂停";
    });

    updateSidebarStatus();
    updateCounters();
    refreshCharts();
  }

  function refreshCharts() {
    state.charts.forEach(function (item) {
      try {
        item.refresh();
      } catch (error) {
        /* 图表刷新失败不应影响数据更新 */
      }
    });
  }

  function updateCounters() {
    var alarmCounts = data.getAlarmCounts();
    var unread = data.getUnreadCount();
    if (elements.bellBadge) {
      elements.bellBadge.textContent = unread > 99 ? "99+" : String(unread);
      elements.bellBadge.hidden = unread === 0;
    }
    if (elements.navAlarmCount) {
      elements.navAlarmCount.textContent = alarmCounts.open;
      elements.navAlarmCount.hidden = alarmCounts.open === 0;
    }
    qsa('[data-live-kpi="openAlarms"]').forEach(function (element) {
      element.textContent = alarmCounts.open;
    });
  }

  function updateSidebarStatus() {
    if (!elements.simStatus) return;
    elements.simStatus.classList.toggle("is-paused", !data.settings.autoRefresh);
    var title = elements.simStatus.querySelector("strong");
    if (title) title.textContent = data.settings.autoRefresh ? "本地模拟器运行中" : "模拟器已暂停";
    if (elements.simStatusDetail) {
      elements.simStatusDetail.textContent = "采样间隔 " + data.settings.intervalMs / 1000 + " 秒";
    }
    syncAutoRefreshControls();
    syncIntervalControls();
  }

  function syncAutoRefreshControls() {
    ["monitorAutoRefresh", "configAutoRefresh", "settingsAutoRefresh", "drawerAutoRefresh"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.checked = data.settings.autoRefresh;
    });
  }

  function syncIntervalControls() {
    ["configInterval", "settingsInterval", "drawerInterval"].forEach(function (id) {
      var select = document.getElementById(id);
      if (select) select.value = String(data.settings.intervalMs);
    });
  }

  /* ------------------------------------------------------------------------
   * 表格筛选
   * --------------------------------------------------------------------- */

  function matchesText(row, query) {
    if (!query) return true;
    return (row.getAttribute("data-search") || "").indexOf(query.toLowerCase()) >= 0;
  }

  function applyAllFilters() {
    filterInstanceRows();
    filterAlarmRows("alarmCenterBody", "alarmEmptyRow", "alarmResultCount", "alarmFooterCount", {
      severity: filters.alarmSeverity,
      status: filters.alarmStatus,
      query: filters.alarmSearch
    });
    filterAlarmRows("instanceAlarmBody", "instanceAlarmEmptyRow", "instanceAlarmCount", "instanceAlarmFooter", {
      severity: filters.instanceAlarmSeverity,
      status: filters.instanceAlarmStatus,
      query: filters.instanceAlarmSearch
    });
  }

  function filterInstanceRows() {
    var rows = qsa("[data-instance-row]");
    if (!rows.length) return;
    var query = filters.instancesSearch.trim().toLowerCase();
    var status = filters.instancesStatus;
    var location = filters.instancesLocation;
    var visible = 0;

    rows.forEach(function (row) {
      var match = matchesText(row, query) &&
        (status === "all" || row.getAttribute("data-status") === status) &&
        (location === "all" || row.getAttribute("data-location") === location);
      row.hidden = !match;
      if (match) visible += 1;
    });

    ["instanceResultCount", "instanceFooterCount"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = visible;
    });
    var empty = document.getElementById("instanceEmptyRow");
    if (empty) empty.hidden = visible > 0;
  }

  function filterAlarmRows(bodyId, emptyId, countId, footerId, options) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    var rows = Array.prototype.slice.call(body.querySelectorAll("[data-alarm-row]"));
    var query = (options.query || "").trim().toLowerCase();
    var visible = 0;

    rows.forEach(function (row) {
      var match = matchesText(row, query) &&
        (!options.severity || options.severity === "all" || row.getAttribute("data-severity") === options.severity) &&
        (!options.status || options.status === "all" || row.getAttribute("data-status") === options.status);
      row.hidden = !match;
      if (match) visible += 1;
    });

    [countId, footerId].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = visible;
    });
    var empty = document.getElementById(emptyId);
    if (empty) empty.hidden = visible > 0;
  }

  function resetInstanceFilters() {
    filters.instancesSearch = "";
    filters.instancesStatus = "all";
    filters.instancesLocation = "all";
    renderRoute({ preserveScroll: true });
  }

  function resetAlarmCenterFilters() {
    filters.alarmSearch = "";
    filters.alarmSeverity = "all";
    filters.alarmStatus = "all";
    renderRoute({ preserveScroll: true });
  }

  function resetInstanceAlarmFilters() {
    filters.instanceAlarmSearch = "";
    filters.instanceAlarmSeverity = "all";
    filters.instanceAlarmStatus = "all";
    renderRoute({ preserveScroll: true });
  }

  /* ------------------------------------------------------------------------
   * 提示、弹窗、抽屉
   * --------------------------------------------------------------------- */

  function showToast(message, tone) {
    if (!elements.toastHost) return;
    while (elements.toastHost.children.length >= 3) {
      elements.toastHost.removeChild(elements.toastHost.firstElementChild);
    }
    var toast = document.createElement("div");
    var icon = tone === "danger" ? "alert" : tone === "warning" ? "info" : "check-circle";
    toast.className = "toast toast--" + (tone || "success");
    toast.innerHTML = '<span class="toast__icon">' + util.icon(icon) + "</span><span>" + e(message) + "</span>";
    elements.toastHost.appendChild(toast);
    global.setTimeout(function () {
      toast.classList.add("is-leaving");
      global.setTimeout(function () {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 240);
    }, 3000);
  }

  function openModal(options) {
    options = options || {};
    elements.modalTitle.textContent = options.title || "提示";
    elements.modalBody.innerHTML = options.body || "";
    elements.modalFoot.innerHTML = options.footer || '<button class="btn btn--secondary" type="button" data-modal-cancel>关闭</button>';
    elements.modalOverlay.hidden = false;
    document.body.classList.add("overlay-open");
    var focusable = elements.modalOverlay.querySelector("button, input, select");
    if (focusable) global.setTimeout(function () { focusable.focus(); }, 30);
  }

  function closeModal() {
    elements.modalOverlay.hidden = true;
    state.pendingConfirm = null;
    if (!isOverlayOpen()) document.body.classList.remove("overlay-open");
  }

  function confirmAction(options) {
    state.pendingConfirm = options.onConfirm;
    openModal({
      title: options.title,
      body: options.body,
      footer: '<button class="btn btn--secondary" type="button" data-modal-cancel>取消</button>' +
        '<button class="btn ' + (options.danger ? "btn--danger" : "btn--primary") + '" type="button" data-modal-confirm>' +
        e(options.confirmLabel || "确认") + "</button>"
    });
  }

  function showHelp() {
    openModal({
      title: "使用帮助",
      body: '<div class="help-grid">' +
        '<div><strong>全局搜索</strong><p>按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 搜索实例、页面与告警。</p></div>' +
        '<div><strong>实例详情</strong><p>在实例列表中点击实例名称，进入概览、监控、健康分析等多级页面。</p></div>' +
        '<div><strong>模拟控制</strong><p>自动模式按固定间隔生成数据；手动模式可拖动油温、负载、振动、局放四项指标。</p></div>' +
        '<div><strong>完全离线</strong><p>桌面版不建立外部网络连接，所有设置与数据均保存在本机。</p></div>' +
      "</div>",
      footer: '<button class="btn btn--primary" type="button" data-modal-cancel>知道了</button>'
    });
  }

  function showOfflineInfo() {
    openModal({
      title: "离线运行模式",
      body: '<div class="offline-info">' +
        '<div class="offline-info__hero">' + util.icon("lock") + "<div><strong>本应用只在本机运行</strong><p>不包含登录、云同步、远程配置或自动更新功能。</p></div></div>" +
        '<ul class="check-list check-list--compact">' +
          '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>外部请求拦截</strong><p>桌面版在 Electron 主进程中阻止 HTTP、HTTPS、WebSocket 请求。</p></div></li>" +
          '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>本地数据</strong><p>模拟数据、阈值策略与告警确认状态只保存在当前设备。</p></div></li>" +
          '<li><span class="check-icon">' + util.icon("check-circle") + "</span><div><strong>无需互联网</strong><p>安装包包含全部页面资源与运行环境，离线可直接启动。</p></div></li>" +
        "</ul></div>",
      footer: '<button class="btn btn--primary" type="button" data-modal-cancel>关闭</button>'
    });
  }

  function closeNotifications() {
    if (!elements.notificationPopover) return;
    elements.notificationPopover.hidden = true;
    if (elements.bellButton) elements.bellButton.setAttribute("aria-expanded", "false");
  }

  function toggleNotifications() {
    var shouldOpen = elements.notificationPopover.hidden;
    closeCommand();
    renderNotifications();
    elements.notificationPopover.hidden = !shouldOpen;
    if (elements.bellButton) elements.bellButton.setAttribute("aria-expanded", String(shouldOpen));
  }

  function renderNotifications() {
    var alarms = data.getRecentAlarms(6);
    if (!alarms.length) {
      elements.notificationList.innerHTML = '<div class="popover__empty">' + util.icon("check-circle") + "<span>暂无新通知</span></div>";
      return;
    }
    elements.notificationList.innerHTML = alarms.map(function (alarm) {
      var instance = data.getInstance(alarm.instanceId);
      return '<a class="notice-item' + (alarm.read ? "" : " is-unread") + '" href="#/instances/' +
        encodeURIComponent(alarm.instanceId) + '/alarms" data-notification-id="' + e(alarm.id) + '">' +
        '<span class="notice-item__icon notice-item__icon--' + util.severityMeta(alarm.severity).tone + '">' +
          util.icon(util.severityMeta(alarm.severity).icon) + "</span>" +
        '<div class="notice-item__body"><strong>' + e(alarm.category) + "</strong><p>" +
          e(instance ? instance.name : alarm.instanceId) + " · " + e(alarm.message) + "</p>" +
          '<span>' + util.timeAgo(alarm.createdAt) + "</span></div>" +
        (alarm.read ? "" : '<span class="notice-item__dot"></span>') +
      "</a>";
    }).join("");
  }

  function openCommand() {
    closeNotifications();
    elements.commandOverlay.hidden = false;
    document.body.classList.add("overlay-open");
    elements.commandInput.value = "";
    state.commandIndex = 0;
    renderCommandResults("");
    global.setTimeout(function () {
      elements.commandInput.focus();
    }, 30);
  }

  function closeCommand() {
    if (!elements.commandOverlay) return;
    elements.commandOverlay.hidden = true;
    if (!isOverlayOpen()) document.body.classList.remove("overlay-open");
  }

  function commandItems() {
    var items = [
      { group: "页面", label: "运维总览", meta: "工作台 · 全局状态", href: "#/overview", icon: "grid" },
      { group: "页面", label: "变压器实例", meta: "资源管理 · 实例列表", href: "#/instances", icon: "server" },
      { group: "页面", label: "告警中心", meta: "监控运维 · 全部告警", href: "#/alarms", icon: "alert" },
      { group: "页面", label: "采集节点", meta: "资源管理 · 本地通道", href: "#/nodes", icon: "cpu" },
      { group: "页面", label: "巡检任务", meta: "监控运维 · 本机巡检", href: "#/inspections", icon: "clipboard" },
      { group: "页面", label: "健康评估", meta: "智能分析 · 健康排名", href: "#/health", icon: "heart" },
      { group: "页面", label: "历史趋势", meta: "智能分析 · 历史数据", href: "#/history", icon: "chart" },
      { group: "页面", label: "阈值策略", meta: "系统管理 · 告警阈值", href: "#/strategies", icon: "shield" },
      { group: "页面", label: "离线设置", meta: "系统管理 · 本地配置", href: "#/settings", icon: "settings" }
    ];
    data.instances.forEach(function (instance) {
      items.push({
        group: "实例",
        label: instance.name,
        meta: instance.id + " · " + instance.location + " · " + util.statusMeta(instance.status).label,
        href: "#/instances/" + encodeURIComponent(instance.id) + "/overview",
        icon: "server"
      });
    });
    data.getRecentAlarms(4).forEach(function (alarm) {
      var instance = data.getInstance(alarm.instanceId);
      items.push({
        group: "告警",
        label: alarm.category,
        meta: (instance ? instance.name : alarm.instanceId) + " · " + alarm.message,
        href: "#/instances/" + encodeURIComponent(alarm.instanceId) + "/alarms",
        icon: "alert"
      });
    });
    return items;
  }

  function renderCommandResults(query) {
    var normalized = String(query || "").trim().toLowerCase();
    var items = commandItems().filter(function (item) {
      if (!normalized) return true;
      return (item.label + " " + item.meta).toLowerCase().indexOf(normalized) >= 0;
    });
    state.commandItems = items;
    state.commandIndex = Math.min(state.commandIndex, Math.max(0, items.length - 1));
    if (!items.length) {
      elements.commandResults.innerHTML = '<div class="command-empty">' + util.icon("search") + "<span>未找到匹配的页面或实例</span></div>";
      return;
    }
    var html = "";
    var group = "";
    items.forEach(function (item, index) {
      if (item.group !== group) {
        group = item.group;
        html += '<div class="command-group">' + e(group) + "</div>";
      }
      html += '<button class="command-item' + (index === state.commandIndex ? " is-active" : "") + '" type="button" data-command-index="' + index + '">' +
        '<span class="command-item__icon">' + util.icon(item.icon) + "</span>" +
        '<span class="command-item__body"><strong>' + e(item.label) + "</strong><small>" + e(item.meta) + "</small></span>" +
        util.icon("chevron-right", "command-item__arrow") +
      "</button>";
    });
    elements.commandResults.innerHTML = html;
  }

  function openDrawer(instanceId) {
    var instance = data.getInstance(instanceId) || data.instances[0];
    if (!instance) return;
    state.drawerInstanceId = instance.id;
    closeNotifications();
    closeCommand();
    renderDrawer();
    elements.drawerOverlay.hidden = false;
    document.body.classList.add("overlay-open");
    global.setTimeout(function () {
      if (elements.drawerClose) elements.drawerClose.focus();
    }, 30);
  }

  function closeDrawer() {
    elements.drawerOverlay.hidden = true;
    state.drawerInstanceId = null;
    if (!isOverlayOpen()) document.body.classList.remove("overlay-open");
    var route = state.route;
    if (route && state.pageNeedsRefresh && route.name !== "strategies" && route.name !== "settings" &&
      !(route.name === "instance" && route.tab === "config")) {
      renderRoute({ preserveScroll: true });
    }
    state.pageNeedsRefresh = false;
  }

  function drawerSummaryHtml(instance) {
    var theme = util.stateTheme(instance.status);
    return '<div class="drawer-score">' + ui.scoreRing(instance.health, instance.status, { size: 126 }) + "</div>" +
      '<div class="drawer-score__copy"><div>' + ui.statusTag(instance.status) + "</div>" +
        '<h3 style="color:' + theme.color + '">' + util.formatNumber(instance.health, 1) + " 分</h3>" +
        "<p>" + e(h.diagnosisText(instance)) + "</p>" +
        '<div class="drawer-mini-metrics">' +
          '<span>油温 <b>' + util.formatNumber(instance.metrics.oilTemp, 1) + " °C</b></span>" +
          '<span>负载 <b>' + util.formatNumber(instance.metrics.load, 1) + "%</b></span>" +
          '<span>振动 <b>' + util.formatNumber(instance.metrics.vibration, 1) + " mm/s</b></span>" +
          '<span>局放 <b>' + util.formatNumber(instance.metrics.partialDischarge, 1) + " pC</b></span>" +
        "</div>" +
      "</div>";
  }

  function renderDrawer() {
    var instance = data.getInstance(state.drawerInstanceId);
    if (!instance) return;
    elements.drawerTitle.textContent = "模拟数据控制";
    elements.drawerSubtitle.textContent = instance.name + " · " + instance.id + " · 完全本地运行";

    var instanceOptions = data.instances.map(function (item) {
      return '<option value="' + e(item.id) + '"' + (item.id === instance.id ? " selected" : "") + ">" +
        e(item.name) + "（" + e(item.code) + "）</option>";
    }).join("");

    var range = {
      oilTemp: { min: 20, max: 120, step: 0.1, unit: "°C", label: "顶层油温" },
      load: { min: 0, max: 110, step: 0.1, unit: "%", label: "负载率" },
      vibration: { min: 0, max: 8, step: 0.1, unit: "mm/s", label: "本体振动" },
      partialDischarge: { min: 0, max: 100, step: 0.1, unit: "pC", label: "局部放电" }
    };

    var autoPanel = '<div class="drawer-section">' +
      '<div class="drawer-section__title">自动模拟参数</div>' +
      '<div class="settings-row"><div><strong>自动刷新</strong><p>按固定间隔生成新的本地采样</p></div>' +
        ui.switchControl("drawerAutoRefresh", data.settings.autoRefresh) + "</div>" +
      '<div class="settings-row"><div><strong>采样间隔</strong><p>控制模拟数据的更新速度</p></div>' +
        '<select class="select select--sm" id="drawerInterval">' +
          [1000, 2000, 5000].map(function (ms) {
            return '<option value="' + ms + '"' + (data.settings.intervalMs === ms ? " selected" : "") + ">" + ms / 1000 + " 秒</option>";
          }).join("") + "</select></div>" +
      '<div class="drawer-section__title drawer-section__title--spaced">手动切换工况</div>' +
      '<div class="scenario-grid">' +
        '<button class="scenario-button scenario-button--normal' + (instance.scenario === "normal" ? " is-active" : "") + '" type="button" data-action="quick-scenario" data-instance="' + e(instance.id) + '" data-value="normal"><span></span>正常运行</button>' +
        '<button class="scenario-button scenario-button--warning' + (instance.scenario === "warning" ? " is-active" : "") + '" type="button" data-action="quick-scenario" data-instance="' + e(instance.id) + '" data-value="warning"><span></span>预警状态</button>' +
        '<button class="scenario-button scenario-button--fault' + (instance.scenario === "fault" ? " is-active" : "") + '" type="button" data-action="quick-scenario" data-instance="' + e(instance.id) + '" data-value="fault"><span></span>故障状态</button>' +
      "</div>" +
      '<div class="drawer-action-row"><button class="btn btn--secondary btn--sm" type="button" data-action="refresh-data">' + util.icon("refresh") + "<span>立即采样</span></button>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="reset-baseline" data-instance="' + e(instance.id) + '">' + util.icon("rotate") + "<span>恢复推荐基线</span></button></div>" +
    "</div>";

    var manualPanel = '<div class="drawer-section">' +
      '<div class="drawer-section__title">手动调节四项指标</div>' +
      '<p class="drawer-note">拖动滑块会立即重新计算健康度，并触发本地阈值判断。</p>' +
      Object.keys(range).map(function (key) {
        var item = range[key];
        var value = instance.metrics[key];
        return '<label class="slider-field"><div class="slider-field__head"><span>' + item.label + "</span>" +
          '<output id="manualOutput-' + key + '">' + util.formatNumber(value, key === "vibration" ? 2 : 1) + " " + item.unit + "</output></div>" +
          '<input type="range" data-manual-key="' + key + '" data-instance="' + e(instance.id) + '" min="' + item.min + '" max="' + item.max + '" step="' + item.step + '" value="' + value + '">' +
          '<div class="slider-field__scale"><span>' + item.min + " " + item.unit + "</span><span>" + item.max + " " + item.unit + "</span></div></label>";
      }).join("") +
      '<div class="manual-actions"><button class="btn btn--secondary btn--sm" type="button" data-action="reset-baseline" data-instance="' + e(instance.id) + '">' + util.icon("rotate") + "<span>恢复推荐基线</span></button>" +
        '<button class="btn btn--primary btn--sm" type="button" data-action="close-drawer">' + util.icon("check-circle") + "<span>完成调节</span></button></div>" +
    "</div>";

    elements.drawerBody.innerHTML =
      '<div class="drawer-instance"><label>控制实例<select id="drawerInstanceSelect">' + instanceOptions + "</select></label>" +
        '<div class="drawer-live-badge"><span class="online-dot"></span>本地模拟</div></div>' +
      '<div class="drawer-summary" id="drawerSummary">' + drawerSummaryHtml(instance) + "</div>" +
      '<div class="drawer-section"><div class="drawer-section__title">数据模式</div>' +
        '<div class="mode-switch">' +
          '<button class="mode-switch__item' + (instance.simMode === "auto" ? " is-active" : "") + '" type="button" data-action="sim-mode" data-instance="' + e(instance.id) + '" data-value="auto">' + util.icon("play") + "<span>自动模拟</span><small>按场景持续生成</small></button>" +
          '<button class="mode-switch__item' + (instance.simMode === "manual" ? " is-active" : "") + '" type="button" data-action="sim-mode" data-instance="' + e(instance.id) + '" data-value="manual">' + util.icon("sliders") + "<span>手动调节</span><small>自定义四项指标</small></button>" +
        "</div></div>" +
      (instance.simMode === "auto" ? autoPanel : manualPanel) +
      '<div class="drawer-foot-note">' + util.icon("lock") + "<span>所有调节只作用于本机模拟数据，不会发送到任何远程系统。</span></div>";
  }

  function refreshDrawerSummary() {
    var instance = data.getInstance(state.drawerInstanceId);
    var summary = document.getElementById("drawerSummary");
    if (instance && summary) summary.innerHTML = drawerSummaryHtml(instance);
  }

  /* ------------------------------------------------------------------------
   * 阈值表单
   * --------------------------------------------------------------------- */

  function readThresholdForm(form, scope) {
    var values = {};
    var errors = [];
    var inputs = Array.prototype.slice.call(form.querySelectorAll("[data-" + scope + "-threshold]"));
    inputs.forEach(function (input) {
      var key = input.getAttribute("data-" + scope + "-threshold");
      var def = util.THRESHOLD_DEFS.find(function (item) { return item.key === key; });
      var raw = input.value.trim();
      var value = Number(raw);
      input.classList.remove("is-invalid");
      if (raw === "" || !Number.isFinite(value)) {
        input.classList.add("is-invalid");
        errors.push(def.label + "不能为空");
      } else if (value < def.min || value > def.max) {
        input.classList.add("is-invalid");
        errors.push(def.label + "需在 " + def.min + " ~ " + def.max + " 之间");
      } else {
        values[key] = util.round(value, def.decimals);
      }
    });
    if (!errors.length && values.warningLower >= values.normalLower) {
      errors.push("正常下限必须大于预警下限");
      inputs.forEach(function (input) {
        var key = input.getAttribute("data-" + scope + "-threshold");
        if (key === "normalLower" || key === "warningLower") input.classList.add("is-invalid");
      });
    }
    return { values: values, errors: errors };
  }

  function handleThresholdSubmit(form) {
    var type = form.getAttribute("data-form");
    var scope = type === "global-thresholds" ? "global" : "instance";
    var result = readThresholdForm(form, scope);
    var errorEl = document.getElementById(scope === "global" ? "globalThresholdError" : "instanceThresholdError");
    if (result.errors.length) {
      if (errorEl) errorEl.textContent = result.errors[0];
      showToast(result.errors[0], "danger");
      return;
    }
    if (errorEl) errorEl.textContent = "";
    if (scope === "global") {
      data.setAllThresholds(result.values);
      showToast("全局阈值已应用到全部实例", "success");
    } else {
      var instanceId = form.getAttribute("data-instance");
      data.setThresholds(instanceId, result.values);
      showToast("实例阈值已保存并立即生效", "success");
    }
    renderRoute({ preserveScroll: true });
  }

  /* ------------------------------------------------------------------------
   * 导出与巡检
   * --------------------------------------------------------------------- */

  function exportInstances() {
    var header = ["实例名称", "实例ID", "状态", "健康度", "油温(°C)", "负载率(%)", "振动(mm/s)", "局放(pC)", "位置", "采集通道"];
    var lines = [header.join(",")];
    data.instances.forEach(function (instance) {
      lines.push([
        instance.name,
        instance.id,
        util.statusMeta(instance.status).label,
        util.formatNumber(instance.health, 1),
        util.formatNumber(instance.metrics.oilTemp, 1),
        util.formatNumber(instance.metrics.load, 1),
        util.formatNumber(instance.metrics.vibration, 1),
        util.formatNumber(instance.metrics.partialDischarge, 1),
        instance.location,
        instance.collector
      ].map(function (value) { return '"' + String(value).replace(/"/g, '""') + '"'; }).join(","));
    });
    var ok = util.downloadText("transformer-instances.csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
    showToast(ok ? "本地实例清单已导出" : "导出失败：当前环境不支持下载", ok ? "success" : "danger");
  }

  function exportHistory() {
    var instance = data.getInstance(filters.historyInstanceId) || data.instances[0];
    var metric = filters.historyMetric || "health";
    var range = filters.historyRange || "24h";
    var meta = metric === "health" ? { label: "健康度", unit: "分" } : util.metricMeta(metric);
    var series = data.getSeries(instance.id, metric, range);
    var lines = ["时间," + meta.label + "(" + meta.unit + ")"];
    series.values.forEach(function (value, index) {
      lines.push('"' + series.labels[index] + '","' + util.formatNumber(value, 1) + '"');
    });
    var ok = util.downloadText("history-" + instance.id + "-" + metric + ".csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
    showToast(ok ? "历史序列已导出" : "导出失败：当前环境不支持下载", ok ? "success" : "danger");
  }

  function runInspection(taskId) {
    var task = data.getTasks().find(function (item) { return item.id === taskId; });
    if (!task) return;
    showToast("巡检任务已启动，正在本机执行", "info");
    renderRoute({ preserveScroll: true });
    data.runInspection(taskId).then(function (completed) {
      if (state.route && state.route.name === "inspections") {
        renderRoute({ preserveScroll: true });
      }
      showToast(completed.summary, completed.findings ? "warning" : "success");
    });
  }

  /* ------------------------------------------------------------------------
   * 事件处理
   * --------------------------------------------------------------------- */

  function handleClick(event) {
    var actionElement = event.target.closest("[data-action]");
    if (actionElement) {
      if (actionElement.disabled) return;
      var action = actionElement.getAttribute("data-action");
      var instanceId = actionElement.getAttribute("data-instance") || state.route.instanceId;
      switch (action) {
        case "refresh-data":
          data.tickNow();
          showToast("本地模拟数据已刷新", "success");
          break;
        case "open-sim":
          openDrawer(instanceId || "TR-220-001");
          break;
        case "close-drawer":
          closeDrawer();
          break;
        case "copy-text":
          util.copyText(actionElement.getAttribute("data-copy") || "").then(function () {
            showToast("实例 ID 已复制", "success");
          }).catch(function () {
            showToast("复制失败，请手动选择文本", "danger");
          });
          break;
        case "ack-alarm":
          if (data.acknowledgeAlarm(actionElement.getAttribute("data-alarm"))) {
            showToast("告警已确认", "success");
            renderRoute({ preserveScroll: true });
          }
          break;
        case "ack-all-alarms":
          var acknowledged = data.acknowledgeAll(actionElement.getAttribute("data-instance") || null);
          showToast(acknowledged ? "已确认 " + acknowledged + " 条告警" : "没有待确认告警", acknowledged ? "success" : "info");
          if (acknowledged) renderRoute({ preserveScroll: true });
          break;
        case "quick-scenario":
          data.setScenario(actionElement.getAttribute("data-instance"), actionElement.getAttribute("data-value"));
          if (state.drawerInstanceId) renderDrawer();
          updateLiveValues();
          renderRoute({ preserveScroll: true });
          showToast("模拟工况已切换", "success");
          break;
        case "sim-mode":
          data.setSimMode(actionElement.getAttribute("data-instance"), actionElement.getAttribute("data-value"));
          renderDrawer();
          updateLiveValues();
          break;
        case "reset-baseline":
          data.resetInstanceBaseline(actionElement.getAttribute("data-instance") || state.drawerInstanceId);
          if (state.drawerInstanceId) renderDrawer();
          updateLiveValues();
          showToast("已恢复推荐模拟基线", "success");
          break;
        case "reset-instance-thresholds":
          data.resetThresholds(actionElement.getAttribute("data-instance"));
          showToast("已恢复全局默认阈值", "success");
          renderRoute({ preserveScroll: true });
          break;
        case "reset-all-thresholds":
          confirmAction({
            title: "恢复初始阈值策略",
            body: "将把全部实例的阈值恢复为应用初始值，是否继续？",
            confirmLabel: "恢复",
            onConfirm: function () {
              data.setAllThresholds(data.DEFAULT_THRESHOLDS);
              showToast("全部实例已恢复初始阈值", "success");
              renderRoute({ preserveScroll: true });
            }
          });
          break;
        case "run-inspection":
          runInspection(actionElement.getAttribute("data-task"));
          break;
        case "reset-instance-filters":
          resetInstanceFilters();
          break;
        case "reset-alarm-filters":
          resetAlarmCenterFilters();
          break;
        case "reset-instance-alarm-filters":
          resetInstanceAlarmFilters();
          break;
        case "export-instances":
          exportInstances();
          break;
        case "export-history":
          exportHistory();
          break;
        case "export-snapshot":
          var ok = util.downloadText(
            "transformer-offline-snapshot-" + new Date().toISOString().slice(0, 10) + ".json",
            data.exportSnapshot(),
            "application/json;charset=utf-8"
          );
          showToast(ok ? "本地快照已导出" : "导出失败：当前环境不支持下载", ok ? "success" : "danger");
          break;
        case "reset-demo":
          confirmAction({
            title: "重置本地演示数据",
            body: "将清空本机保存的阈值、告警确认状态并恢复全部初始模拟数据。此操作不可撤销。",
            confirmLabel: "确认重置",
            danger: true,
            onConfirm: function () {
              data.resetDemoData();
              closeDrawer();
              showToast("本地演示数据已重置", "success");
              global.location.hash = "#/overview";
              renderRoute({ preserveScroll: false });
            }
          });
          break;
        default:
          break;
      }
      return;
    }

    var rangeButton = event.target.closest("[data-range]");
    if (rangeButton) {
      var group = rangeButton.closest("[data-range-group]");
      var groupName = group ? group.getAttribute("data-range-group") : null;
      var value = rangeButton.getAttribute("data-range");
      if (groupName === "detail") filters.detailRange = value;
      else if (groupName === "monitor") filters.monitorRange = value;
      else if (groupName === "health") filters.healthRange = value;
      else if (groupName === "history") filters.historyRange = value;
      renderRoute({ preserveScroll: true });
      return;
    }

    var commandItem = event.target.closest("[data-command-index]");
    if (commandItem) {
      var index = Number(commandItem.getAttribute("data-command-index"));
      var item = state.commandItems[index];
      if (item) {
        closeCommand();
        navigate(item.href);
      }
      return;
    }

    var notice = event.target.closest("[data-notification-id]");
    if (notice) {
      data.markNotificationRead(notice.getAttribute("data-notification-id"));
      closeNotifications();
      return;
    }

    if (event.target.closest("[data-modal-confirm]")) {
      var confirm = state.pendingConfirm;
      closeModal();
      if (confirm) confirm();
      return;
    }

    if (event.target.closest("[data-modal-cancel]") || event.target === elements.modalOverlay) {
      closeModal();
      return;
    }

    if (event.target === elements.drawerOverlay) {
      closeDrawer();
      return;
    }

    if (event.target === elements.commandOverlay) {
      closeCommand();
      return;
    }

    if (elements.notificationPopover && !elements.notificationPopover.hidden &&
      !elements.notificationPopover.contains(event.target) && !elements.bellButton.contains(event.target)) {
      closeNotifications();
    }
  }

  function handleSubmit(event) {
    var form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    handleThresholdSubmit(form);
  }

  function handleInput(event) {
    var target = event.target;

    if (target.id === "instanceSearch") {
      filters.instancesSearch = target.value;
      filterInstanceRows();
      return;
    }
    if (target.id === "alarmSearch") {
      filters.alarmSearch = target.value;
      filterAlarmRows("alarmCenterBody", "alarmEmptyRow", "alarmResultCount", "alarmFooterCount", {
        severity: filters.alarmSeverity, status: filters.alarmStatus, query: filters.alarmSearch
      });
      return;
    }
    if (target.id === "instanceAlarmSearch") {
      filters.instanceAlarmSearch = target.value;
      filterAlarmRows("instanceAlarmBody", "instanceAlarmEmptyRow", "instanceAlarmCount", "instanceAlarmFooter", {
        severity: filters.instanceAlarmSeverity, status: filters.instanceAlarmStatus, query: filters.instanceAlarmSearch
      });
      return;
    }

    if (target.matches("[data-manual-key]")) {
      var key = target.getAttribute("data-manual-key");
      var instanceId = target.getAttribute("data-instance");
      data.setManualMetric(instanceId, key, target.value);
      var output = document.getElementById("manualOutput-" + key);
      if (output) {
        var unit = util.metricMeta(key).unit;
        output.textContent = util.formatNumber(target.value, key === "vibration" ? 2 : 1) + " " + unit;
      }
      refreshDrawerSummary();
      updateLiveValues();
      state.pageNeedsRefresh = true;
      return;
    }

    if (target.matches("[data-instance-threshold], [data-global-threshold]")) {
      target.classList.remove("is-invalid");
      var error = document.getElementById(target.hasAttribute("data-global-threshold") ? "globalThresholdError" : "instanceThresholdError");
      if (error) error.textContent = "";
    }
  }

  function handleChange(event) {
    var target = event.target;

    if (target.id === "instanceStatusFilter") {
      filters.instancesStatus = target.value;
      filterInstanceRows();
      return;
    }
    if (target.id === "instanceLocationFilter") {
      filters.instancesLocation = target.value;
      filterInstanceRows();
      return;
    }
    if (target.id === "alarmSeverityFilter") {
      filters.alarmSeverity = target.value;
      filterAlarmRows("alarmCenterBody", "alarmEmptyRow", "alarmResultCount", "alarmFooterCount", {
        severity: filters.alarmSeverity, status: filters.alarmStatus, query: filters.alarmSearch
      });
      return;
    }
    if (target.id === "alarmStatusFilter") {
      filters.alarmStatus = target.value;
      filterAlarmRows("alarmCenterBody", "alarmEmptyRow", "alarmResultCount", "alarmFooterCount", {
        severity: filters.alarmSeverity, status: filters.alarmStatus, query: filters.alarmSearch
      });
      return;
    }
    if (target.id === "instanceAlarmSeverityFilter") {
      filters.instanceAlarmSeverity = target.value;
      filterAlarmRows("instanceAlarmBody", "instanceAlarmEmptyRow", "instanceAlarmCount", "instanceAlarmFooter", {
        severity: filters.instanceAlarmSeverity, status: filters.instanceAlarmStatus, query: filters.instanceAlarmSearch
      });
      return;
    }
    if (target.id === "instanceAlarmStatusFilter") {
      filters.instanceAlarmStatus = target.value;
      filterAlarmRows("instanceAlarmBody", "instanceAlarmEmptyRow", "instanceAlarmCount", "instanceAlarmFooter", {
        severity: filters.instanceAlarmSeverity, status: filters.instanceAlarmStatus, query: filters.instanceAlarmSearch
      });
      return;
    }

    if (target.matches('input[type="checkbox"]') && target.closest(".switch")) {
      if (["monitorAutoRefresh", "configAutoRefresh", "settingsAutoRefresh", "drawerAutoRefresh"].indexOf(target.id) >= 0) {
        data.setAutoRefresh(target.checked);
        updateSidebarStatus();
        showToast(target.checked ? "自动刷新已开启" : "自动刷新已暂停", target.checked ? "success" : "info");
        return;
      }
    }

    if (target.id === "configInterval" || target.id === "settingsInterval" || target.id === "drawerInterval") {
      data.setIntervalMs(target.value);
      updateSidebarStatus();
      showToast("采样间隔已调整为 " + Number(target.value) / 1000 + " 秒", "success");
      return;
    }

    if (target.id === "drawerInstanceSelect") {
      openDrawer(target.value);
      return;
    }

    if (target.id === "historyInstance") {
      filters.historyInstanceId = target.value;
      renderRoute({ preserveScroll: true });
      return;
    }
    if (target.id === "historyMetric") {
      filters.historyMetric = target.value;
      renderRoute({ preserveScroll: true });
      return;
    }
  }

  function handleCommandKeydown(event) {
    if (elements.commandOverlay.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.commandIndex = Math.min(state.commandItems.length - 1, state.commandIndex + 1);
      renderCommandResults(elements.commandInput.value);
      var active = elements.commandResults.querySelector(".command-item.is-active");
      if (active) active.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.commandIndex = Math.max(0, state.commandIndex - 1);
      renderCommandResults(elements.commandInput.value);
      var up = elements.commandResults.querySelector(".command-item.is-active");
      if (up) up.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      var item = state.commandItems[state.commandIndex];
      if (item) {
        closeCommand();
        navigate(item.href);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeCommand();
    }
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (elements.commandOverlay.hidden) openCommand();
      else closeCommand();
      return;
    }

    if (event.key === "Escape") {
      if (!elements.modalOverlay.hidden) {
        closeModal();
        return;
      }
      if (!elements.drawerOverlay.hidden) {
        closeDrawer();
        return;
      }
      if (!elements.commandOverlay.hidden) {
        closeCommand();
        return;
      }
      if (!elements.notificationPopover.hidden) {
        closeNotifications();
        return;
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    document.addEventListener("keydown", handleKeydown);
    elements.commandInput.addEventListener("keydown", handleCommandKeydown);
    elements.commandInput.addEventListener("input", function () {
      state.commandIndex = 0;
      renderCommandResults(elements.commandInput.value);
    });

    elements.searchTrigger.addEventListener("click", openCommand);
    elements.bellButton.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleNotifications();
    });
    elements.markAllRead.addEventListener("click", function () {
      data.markAllNotificationsRead();
      renderNotifications();
      updateCounters();
    });
    elements.helpButton.addEventListener("click", showHelp);
    elements.drawerClose.addEventListener("click", closeDrawer);
    elements.modalClose.addEventListener("click", closeModal);

    var offlineChip = document.querySelector(".offline-chip");
    if (offlineChip) {
      offlineChip.style.cursor = "pointer";
      offlineChip.addEventListener("click", showOfflineInfo);
    }
    var userChip = document.querySelector(".user-chip");
    if (userChip) {
      userChip.style.cursor = "pointer";
      userChip.addEventListener("click", function () {
        showToast("当前为本地管理员账号，无需联网登录", "info");
      });
    }

    qsa(".nav-group__head").forEach(function (head) {
      head.addEventListener("click", function () {
        var group = head.closest(".nav-group");
        var open = group.classList.toggle("is-open");
        head.setAttribute("aria-expanded", String(open));
      });
    });

    function toggleSidebar() {
      var collapsed = document.body.classList.toggle("sidebar-collapsed");
      data.setSidebarCollapsed(collapsed);
      if (elements.collapseButton) {
        var label = elements.collapseButton.querySelector("span");
        if (label) label.textContent = collapsed ? "展开菜单" : "收起菜单";
      }
    }
    elements.sidebarToggle.addEventListener("click", toggleSidebar);
    if (elements.collapseButton) elements.collapseButton.addEventListener("click", toggleSidebar);

    global.addEventListener("hashchange", function () {
      renderRoute({ preserveScroll: false });
    });
  }

  /* ------------------------------------------------------------------------
   * 数据订阅
   * --------------------------------------------------------------------- */

  function canAutoRefreshPage() {
    if (isOverlayOpen()) return false;
    if (isTyping()) return false;
    if (!state.route) return false;
    if (state.route.name === "strategies" || state.route.name === "settings") return false;
    if (state.route.name === "instance" && state.route.tab === "config") return false;
    return true;
  }

  function scheduleRouteRefresh() {
    if (state.scheduledRender) return;
    state.scheduledRender = global.setTimeout(function () {
      state.scheduledRender = null;
      if (canAutoRefreshPage()) {
        renderRoute({ preserveScroll: true });
        if (state.drawerInstanceId) renderDrawer();
      }
    }, 140);
  }

  function onDataEvent(type, payload) {
    if (type === "tick") {
      updateLiveValues();
      var changed = statusesChanged(state.statusSnapshot);
      state.statusSnapshot = buildStatusSnapshot();
      if (state.drawerInstanceId) {
        refreshDrawerSummary();
        if (changed) state.pageNeedsRefresh = true;
      }
      if (changed && canAutoRefreshPage()) scheduleRouteRefresh();
      return;
    }

    if (type === "alarm") {
      var instance = data.getInstance(payload.instanceId);
      updateCounters();
      showToast((payload.severity === "critical" ? "严重告警 · " : "新告警 · ") +
        (instance ? instance.name : payload.instanceId) + "：" + payload.category,
        payload.severity === "critical" ? "danger" : "warning");
      if (state.drawerInstanceId) refreshDrawerSummary();
      if (canAutoRefreshPage() &&
        (state.route.name === "alarms" || state.route.name === "overview" ||
          (state.route.name === "instance" && state.route.tab === "alarms"))) {
        scheduleRouteRefresh();
      }
      return;
    }

    if (type === "alarm-updated") {
      updateCounters();
      if (canAutoRefreshPage() && (state.route.name === "alarms" || (state.route.name === "instance" && state.route.tab === "alarms"))) {
        renderRoute({ preserveScroll: true });
      }
      if (!elements.notificationPopover.hidden) renderNotifications();
      return;
    }

    if (type === "notifications") {
      updateCounters();
      if (!elements.notificationPopover.hidden) renderNotifications();
      return;
    }

    if (type === "settings") {
      updateSidebarStatus();
      updateLiveValues();
      if (data.settings.autoRefresh && !data.timer) data.start();
      return;
    }

    if (type === "sim") {
      updateLiveValues();
      if (state.drawerInstanceId) refreshDrawerSummary();
      if (canAutoRefreshPage() && state.route.name === "instance") {
        state.pageNeedsRefresh = true;
      }
      return;
    }

    if (type === "inspection") {
      if (state.route && state.route.name === "inspections") {
        renderRoute({ preserveScroll: true });
      }
      return;
    }

    if (type === "reset") {
      state.statusSnapshot = buildStatusSnapshot();
      if (state.route) renderRoute({ preserveScroll: true });
    }
  }

  /* ------------------------------------------------------------------------
   * 启动
   * --------------------------------------------------------------------- */

  function init() {
    if (!global.location.hash) {
      try {
        global.history.replaceState(null, "", "#/overview");
      } catch (error) {
        /* file:// 下部分浏览器可能拒绝改写地址 */
      }
    }
    if (data.settings.sidebarCollapsed) {
      document.body.classList.add("sidebar-collapsed");
      if (elements.collapseButton) {
        var label = elements.collapseButton.querySelector("span");
        if (label) label.textContent = "展开菜单";
      }
    }
    qsa(".nav-item").forEach(function (item) {
      item.title = item.textContent.trim().replace(/\s+/g, " ");
    });
    bindEvents();
    renderRoute({ preserveScroll: false });
    updateCounters();
    data.subscribe(onDataEvent);
    if (data.settings.autoRefresh) data.start();
    global.setInterval(function () {
      qsa("[data-live-updated]").forEach(function (element) {
        var instance = data.getInstance(element.getAttribute("data-instance"));
        if (instance) element.textContent = util.timeAgo(instance.lastUpdated);
      });
    }, 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  Cloud.app = {
    render: renderRoute,
    navigate: navigate,
    openDrawer: openDrawer,
    showToast: showToast,
    getState: function () { return state; }
  };
})(window);
