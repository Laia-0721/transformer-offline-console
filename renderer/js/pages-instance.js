/*
 * 实例详情 · 概览 / 实时监控 / 健康分析 / 告警记录 / 配置诊断
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

  function statusBanner(instance) {
    if (instance.status === "fault") {
      return '<div class="status-banner status-banner--danger">' +
        '<span class="status-banner__icon">' + util.icon("alert") + "</span>" +
        '<div><strong>故障告警：健康度 ' + util.formatNumber(instance.health, 1) + " 分</strong>" +
        "<p>当前健康度低于预警下限 " + instance.thresholds.warningLower + " 分，建议立即安排现场检查并降低运行负载。</p></div>" +
        '<a class="btn btn--sm btn--danger" href="' + h.instanceHref(instance, "alarms") + '">查看告警</a></div>';
    }
    if (instance.status === "warning") {
      return '<div class="status-banner status-banner--warning">' +
        '<span class="status-banner__icon">' + util.icon("info") + "</span>" +
        '<div><strong>预警关注：健康度 ' + util.formatNumber(instance.health, 1) + " 分</strong>" +
        "<p>设备已进入预警区间，建议关注温升、振动与局放变化，并检查冷却系统。</p></div>" +
        '<a class="btn btn--sm btn--warning" href="' + h.instanceHref(instance, "health") + '">健康分析</a></div>';
    }
    if (instance.status === "maintenance") {
      return '<div class="status-banner status-banner--neutral">' +
        '<span class="status-banner__icon">' + util.icon("wrench") + "</span>" +
        "<div><strong>设备处于检修状态</strong><p>在线模拟数据暂停，预计 " + e(instance.maintenanceUntil || "--") + " 恢复。当前健康度保留最近一次评估结果。</p></div>" +
        '<button class="btn btn--sm btn--secondary" type="button" data-action="open-sim" data-instance="' + e(instance.id) + '">查看模拟设置</button></div>';
    }
    return "";
  }

  function instanceSummary(instance) {
    return '<section class="instance-summary">' +
      '<div class="instance-summary__item"><span>实例 ID</span><strong class="mono">' + e(instance.id) +
        '<button class="copy-button" type="button" data-action="copy-text" data-copy="' + e(instance.id) + '" title="复制实例 ID">' +
        util.icon("copy") + "</button></strong></div>" +
      '<div class="instance-summary__item"><span>所在位置</span><strong>' + e(instance.location) + " · " + e(instance.zone) + "</strong></div>" +
      '<div class="instance-summary__item"><span>规格</span><strong>' + e(instance.voltage) + " / " + e(instance.capacity) + "</strong></div>" +
      '<div class="instance-summary__item"><span>采集通道</span><strong>' + e(instance.collector) + "</strong></div>" +
      '<div class="instance-summary__item"><span>投运日期</span><strong>' + e(instance.commissioned) + "</strong></div>" +
      '<div class="instance-summary__item"><span>最近检修</span><strong>' + e(instance.lastOverhaul) + "</strong></div>" +
      '<div class="instance-summary__item"><span>运维班组</span><strong>' + e(instance.operator) + "</strong></div>" +
      '<div class="instance-summary__item"><span>健康模型</span><strong>LSTM + Attention <em class="mono">v2.4.1</em></strong></div>' +
    "</section>";
  }

  function riskRows(instance) {
    return instance.riskFactors.slice(0, 3).map(function (factor) {
      return '<div class="risk-row">' +
        '<div class="risk-row__head"><span>' + e(factor.label) + '</span><b>' + factor.percent + "%</b></div>" +
        '<div class="risk-bar"><i style="width:' + factor.percent + "%\"></i></div>" +
      "</div>";
    }).join("");
  }

  function detailOverview(instance) {
    var openCount = data.getAlarmCounts(instance.id).open;
    var alarms = data.getRecentAlarms(4, instance.id);
    var aiStatusClass = instance.status === "fault" ? "danger" : instance.status === "warning" ? "warning" : "success";
    var content = statusBanner(instance) + instanceSummary(instance);

    content += '<div class="kpi-grid kpi-grid--metrics">' +
      h.healthKpi(instance) +
      h.metricCard(instance, "oilTemp") +
      h.metricCard(instance, "load") +
      h.metricCard(instance, "vibration") +
      h.metricCard(instance, "partialDischarge") +
    "</div>";

    content += '<div class="detail-main-grid">' +
      '<section class="card card--dark topology-card">' +
        '<div class="card-head"><div class="card-head__title"><h2>设备状态拓扑</h2><p>本地实时模拟渲染</p></div>' +
          '<div class="card-head__extra">' + h.liveStatus(instance) + "</div></div>" +
        '<div class="card-body card-body--flush">' + h.deviceSvg(instance) + "</div>" +
        '<div class="topology-footer">' +
          '<div><span>采集通道</span><strong>' + e(instance.collector) + "</strong></div>" +
          '<div><span>采样频率</span><strong>每 ' + data.settings.intervalMs / 1000 + " 秒</strong></div>" +
          '<div><span>最近更新</span><strong>' + h.liveUpdated(instance) + "</strong></div>" +
        "</div>" +
      "</section>" +

      '<section class="card ai-card">' +
        '<div class="card-head"><div class="card-head__title"><h2>AI 健康诊断</h2><p>LSTM + Attention · 本地推理</p></div>' +
          '<span class="tag tag--blue">LOCAL AI</span></div>' +
        '<div class="card-body">' +
          '<div class="ai-hero">' + h.liveRing(instance, 120) +
            '<div class="ai-hero__copy"><div class="ai-status ai-status--' + aiStatusClass + '">' + h.liveStatus(instance) + "</div>" +
              "<h3>" + (instance.status === "fault" ? "需要立即关注" : instance.status === "warning" ? "建议重点关注" : instance.status === "maintenance" ? "检修暂停评估" : "设备运行平稳") + "</h3>" +
              "<p>" + e(h.diagnosisText(instance)) + "</p></div>" +
          "</div>" +
          '<div class="ai-stats">' +
            '<div><span>诊断置信度</span><strong>' + h.liveNumber(instance, "confidence", 1) + "<small>%</small></strong></div>" +
            '<div><span>剩余寿命</span><strong>' + h.liveNumber(instance, "remainingLifeDays", 0) + "<small>天</small></strong></div>" +
            '<div><span>模型版本</span><strong>v2.4.1</strong></div>' +
          "</div>" +
          '<div class="ai-risk"><div class="ai-risk__title"><span>主要健康影响因子</span><a class="text-link" href="' + h.instanceHref(instance, "health") + '">查看完整分析</a></div>' +
            riskRows(instance) +
          "</div>" +
          '<div class="ai-extra">' +
            '<div class="ai-extra__head"><span>未来 7 天风险推演</span><strong class="' +
              (instance.status === "fault" ? "text-danger" : instance.status === "warning" ? "text-warning" : "text-success") + '">' +
              (instance.status === "fault" ? "高风险" : instance.status === "warning" ? "中风险" : "低风险") + "</strong></div>" +
            '<div class="ai-extra__track"><i style="width:' +
              (instance.status === "fault" ? "82" : instance.status === "warning" ? "58" : "24") + '%;background:' +
              (instance.status === "fault" ? "#f04438" : instance.status === "warning" ? "#f79009" : "#17b26a") + '"></i></div>' +
            '<div class="ai-extra__grid">' +
              '<div><span>模型输入</span><strong>60 × 4 特征</strong></div>' +
              '<div><span>推理耗时</span><strong>18 ms</strong></div>' +
              '<div><span>下次评估</span><strong>每 ' + data.settings.intervalMs / 1000 + " 秒</strong></div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</section>" +
    "</div>";

    var range = filters.detailRange;
    var rangeOptions = [
      { value: "live", label: "实时" },
      { value: "30m", label: "30 分钟" },
      { value: "2h", label: "2 小时" }
    ];
    content += '<div class="detail-bottom-grid">' +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>健康度趋势</h2><p>阈值线与实时评估结果</p></div>' +
          '<div class="card-head__extra">' + ui.segmented(rangeOptions, range, { group: "detail" }) + "</div></div>" +
        '<div class="card-body card-body--chart"><div class="chart-box chart-box--detail"><canvas id="detailHealthChart" aria-label="实例健康度趋势"></canvas></div></div>' +
        '<div class="chart-foot"><span><i class="legend-line" style="background:#00a870"></i>健康度</span>' +
          '<span><i class="legend-line legend-line--dash"></i>健康阈值</span>' +
          '<span class="muted">健康度数据为本地模拟推理结果</span></div>' +
      "</section>" +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>最近告警</h2><p>当前实例 · ' + openCount + " 条待处理</p></div>" +
          '<a class="text-link" href="' + h.instanceHref(instance, "alarms") + '">全部' + util.icon("chevron-right") + "</a></div>" +
        '<div class="card-body card-body--flush"><div class="alarm-list alarm-list--compact">' +
          (alarms.length ? alarms.map(function (alarm) { return h.alarmItem(alarm, false); }).join("") :
            ui.emptyState("暂无告警", "该实例运行平稳", "check-circle")) +
        "</div></div></section>" +
    "</div>";

    return content;
  }

  function chartCard(instance, key, range) {
    var meta = util.metricMeta(key);
    var threshold = instance.thresholds[meta.thresholdKey];
    var series = data.getSeries(instance.id, key, range);
    var stats = h.resolveSeriesStats(series);
    return '<section class="card chart-card">' +
      '<div class="card-head"><div class="card-head__title"><h2>' + e(meta.fullLabel) + "</h2><p>" +
        e(meta.unit) + " · 阈值 " + threshold + " " + e(meta.unit) + "</p></div>" +
        '<div class="chart-current"><strong>' + h.liveNumber(instance, "metrics." + key, 1) + "</strong>" + e(meta.unit) + "</div></div>" +
      '<div class="card-body card-body--chart"><div class="chart-box chart-box--monitor"><canvas id="monitorChart-' + e(key) + '" aria-label="' + e(meta.fullLabel) + '趋势"></canvas></div></div>' +
      '<div class="chart-foot"><span>最小 ' + util.formatNumber(stats.min, 1) + " " + e(meta.unit) + "</span>" +
        '<span>平均 ' + util.formatNumber(stats.avg, 1) + " " + e(meta.unit) + "</span>" +
        '<span>最大 ' + util.formatNumber(stats.max, 1) + " " + e(meta.unit) + "</span>" +
        '<span class="muted">本地采样</span></div>' +
    "</section>";
  }

  function detailMonitor(instance) {
    var range = filters.monitorRange;
    var content = '<section class="monitor-toolbar">' +
      '<div class="monitor-toolbar__left">' +
        '<span class="live-indicator"><i></i>实时数据流</span>' +
        '<span class="muted">每 ' + data.settings.intervalMs / 1000 + " 秒更新 · 最近更新 " + h.liveUpdated(instance) + "</span>" +
      "</div>" +
      '<div class="monitor-toolbar__right">' +
        ui.segmented([{ value: "live", label: "实时" }, { value: "30m", label: "30 分钟" }, { value: "2h", label: "2 小时" }], range, { group: "monitor" }) +
        '<label class="switch-inline">' + ui.switchControl("monitorAutoRefresh", data.settings.autoRefresh, "自动刷新") + "</label>" +
      "</div></section>";

    content += '<div class="monitor-summary">' +
      [h.healthKpi(instance), h.metricCard(instance, "oilTemp"), h.metricCard(instance, "load"), h.metricCard(instance, "vibration"), h.metricCard(instance, "partialDischarge")].join("") +
    "</div>";

    content += '<div class="chart-grid">' +
      chartCard(instance, "oilTemp", range) +
      chartCard(instance, "load", range) +
      chartCard(instance, "vibration", range) +
      chartCard(instance, "partialDischarge", range) +
    "</div>";

    content += '<section class="card chart-card chart-card--wide">' +
      '<div class="card-head"><div class="card-head__title"><h2>健康度与诊断置信度</h2><p>AI 模型综合判据</p></div>' +
        '<span class="tag tag--blue">LSTM + Attention v2.4.1</span></div>' +
      '<div class="card-body card-body--chart"><div class="chart-box chart-box--monitor-wide"><canvas id="monitorChart-health" aria-label="健康度趋势"></canvas></div></div>' +
      '<div class="chart-foot"><span><i class="legend-line" style="background:#2563eb"></i>健康度</span>' +
        '<span><i class="legend-line" style="background:#ff8f1f"></i>正常下限</span>' +
        '<span><i class="legend-line" style="background:#f53f3f"></i>预警下限</span>' +
        '<span class="muted">右侧悬浮提示可查看每个采样点</span></div>' +
    "</section>";

    var quality = [
      { label: "采样完整率", value: "99.99%", note: "近 24 小时无缺失" },
      { label: "采集时延", value: "2 ms", note: "本机模拟通道" },
      { label: "数据丢包", value: "0", note: "末尾本地缓冲" },
      { label: "本地存储", value: "12.8 MB", note: "历史采样保留 240 点" }
    ];
    content += '<section class="card"><div class="card-head"><div class="card-head__title"><h2>采样质量</h2><p>本地离线数据链路</p></div>' +
      '<span class="tag tag--green">稳定</span></div><div class="card-body"><div class="quality-grid">' +
      quality.map(function (item) {
        return '<div class="quality-item"><span>' + e(item.label) + "</span><strong>" + e(item.value) + "</strong><small>" + e(item.note) + "</small></div>";
      }).join("") + "</div></div></section>";

    return content;
  }

  function detailHealth(instance) {
    var range = filters.healthRange;
    var recommendations = h.recommendations(instance);
    var theme = util.stateTheme(instance.status);
    var content = '<div class="health-overview-grid">' +
      '<section class="card health-score-card">' +
        '<div class="card-head"><div class="card-head__title"><h2>综合健康评分</h2><p>本地模型推理结果</p></div>' + h.liveStatus(instance) + "</div>" +
        '<div class="card-body"><div class="health-score-main">' + h.liveRing(instance, 156) +
          '<div><h3 style="color:' + theme.color + '">' + e(h.diagnosisText(instance).split("，")[0]) + "</h3>" +
          '<p>' + e(h.diagnosisText(instance)) + "</p>" +
          '<div class="health-score-flags"><span>正常下限 ' + instance.thresholds.normalLower + " 分</span>" +
          "<span>预警下限 " + instance.thresholds.warningLower + " 分</span></div></div>" +
        "</div></div>" +
      "</section>" +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>模型运行信息</h2><p>完全本地推理</p></div><span class="tag tag--neutral">v2.4.1</span></div>' +
        '<div class="card-body"><div class="model-info">' +
          '<div><span>模型结构</span><strong>LSTM + Attention</strong></div>' +
          '<div><span>输入窗口</span><strong>60 个采样点</strong></div>' +
          '<div><span>最近评估</span><strong>' + h.liveUpdated(instance) + "</strong></div>" +
          '<div><span>部署模式</span><strong>本地离线</strong></div>' +
        "</div></div>" +
      "</section>" +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>评估指标</h2><p>可信度与寿命预测</p></div>' + util.icon("activity", "card-head__icon") + "</div>" +
        '<div class="card-body"><div class="health-metric-list">' +
          '<div class="health-metric-row"><span>诊断置信度</span><strong>' + h.liveNumber(instance, "confidence", 1) + "%</strong><small>模型输出</small></div>" +
          '<div class="health-metric-row"><span>剩余寿命预测</span><strong>' + h.liveNumber(instance, "remainingLifeDays", 0) + " 天</strong><small>基于当前工况</small></div>" +
          '<div class="health-metric-row"><span>健康度变化</span><strong class="' + (instance.healthDelta >= 0 ? "text-success" : "text-danger") + '">' + (instance.healthDelta >= 0 ? "+" : "") + util.formatNumber(instance.healthDelta, 1) + " 分</strong><small>较上次采样</small></div>" +
          '<div class="health-metric-row"><span>风险等级</span><strong>' + (instance.status === "fault" ? "高" : instance.status === "warning" ? "中" : "低") + "</strong><small>运营建议</small></div>" +
        "</div></div>" +
      "</section>" +
    "</div>";

    content += '<div class="health-detail-grid">' +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>健康影响因子</h2><p>按当前采样计算的风险贡献</p></div><span class="tag tag--neutral">权重解释</span></div>' +
        '<div class="card-body"><div class="factor-list">' +
          instance.riskFactors.map(function (factor) {
            return '<div class="factor-row"><div class="factor-row__head"><span>' + e(factor.label) + "</span><b>" + factor.percent + "%</b></div>" +
              '<div class="factor-bar"><i style="width:' + factor.percent + '%;background:' + (factor.percent >= 35 ? "#f53f3f" : factor.percent >= 20 ? "#ff8f1f" : "#2563eb") + '"></i></div>' +
              '<small>风险权重 ' + util.formatNumber(factor.weight, 2) + "</small></div>";
          }).join("") + "</div></div>" +
      "</section>" +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>运维建议</h2><p>基于当前健康状态生成</p></div><span class="tag tag--blue">本地规则</span></div>' +
        '<div class="card-body"><ol class="advice-list">' +
          recommendations.map(function (item, index) {
            return "<li><span>" + (index + 1) + "</span><p>" + e(item) + "</p></li>";
          }).join("") + "</ol></div>" +
      "</section>" +
    "</div>";

    content += '<section class="card">' +
      '<div class="card-head"><div class="card-head__title"><h2>健康度历史</h2><p>趋势与阈值对照</p></div>' +
        '<div class="card-head__extra">' + ui.segmented([{ value: "live", label: "实时" }, { value: "30m", label: "30 分钟" }, { value: "2h", label: "2 小时" }], range, { group: "health" }) + "</div></div>" +
      '<div class="card-body card-body--chart"><div class="chart-box chart-box--health"><canvas id="healthTrendChart" aria-label="健康度历史趋势"></canvas></div></div>' +
      '<div class="chart-foot"><span><i class="legend-line" style="background:' + theme.color + '"></i>健康度</span><span class="muted">模型每 ' + data.settings.intervalMs / 1000 + " 秒重新评估</span></div>" +
    "</section>";

    return content;
  }

  function detailAlarms(instance) {
    var counts = data.getAlarmCounts(instance.id);
    var alarms = data.getAlarms({
      instanceId: instance.id,
      severity: filters.instanceAlarmSeverity,
      status: filters.instanceAlarmStatus,
      query: filters.instanceAlarmSearch
    });
    var summary = '<div class="alarm-summary">' +
      '<div><span>待处理</span><strong class="text-danger">' + counts.open + "</strong><small>需人工确认</small></div>" +
      '<div><span>严重</span><strong class="text-danger">' + counts.critical + "</strong><small>最高优先级</small></div>" +
      '<div><span>警告</span><strong class="text-warning">' + counts.warning + "</strong><small>建议尽快查看</small></div>" +
      '<div><span>已确认</span><strong class="text-success">' + counts.acknowledged + "</strong><small>已纳入巡检</small></div>" +
    "</div>";

    var content = summary + '<section class="card filter-card"><div class="filter-bar">' +
      '<label class="search-field"><svg class="icon"><use href="#i-search"></use></svg>' +
        '<input id="instanceAlarmSearch" type="search" placeholder="搜索当前实例告警" value="' + e(filters.instanceAlarmSearch) + '" autocomplete="off"></label>' +
      '<select id="instanceAlarmSeverityFilter" class="select">' +
        '<option value="all"' + (filters.instanceAlarmSeverity === "all" ? " selected" : "") + ">全部级别</option>" +
        '<option value="critical"' + (filters.instanceAlarmSeverity === "critical" ? " selected" : "") + ">严重</option>" +
        '<option value="warning"' + (filters.instanceAlarmSeverity === "warning" ? " selected" : "") + ">警告</option>" +
        '<option value="info"' + (filters.instanceAlarmSeverity === "info" ? " selected" : "") + ">提示</option>" +
      "</select>" +
      '<select id="instanceAlarmStatusFilter" class="select">' +
        '<option value="all"' + (filters.instanceAlarmStatus === "all" ? " selected" : "") + ">全部状态</option>" +
        '<option value="open"' + (filters.instanceAlarmStatus === "open" ? " selected" : "") + ">待处理</option>" +
        '<option value="acknowledged"' + (filters.instanceAlarmStatus === "acknowledged" ? " selected" : "") + ">已确认</option>" +
      "</select>" +
      '<button class="btn btn--ghost" type="button" data-action="reset-instance-alarm-filters">' + util.icon("rotate") + "<span>重置</span></button>" +
      '<span class="filter-bar__count">共 <b id="instanceAlarmCount">' + alarms.length + "</b> 条</span>" +
      '<button class="btn btn--secondary btn--sm filter-bar__right" type="button" data-action="ack-all-alarms" data-instance="' + e(instance.id) + '">全部确认</button>' +
    "</div></section>";

    content += '<section class="card card--table"><div class="card-head"><div class="card-head__title"><h2>告警记录</h2><p>' + e(instance.name) + " · 本地事件流</p></div>" +
      '<span class="tag tag--red">' + counts.open + " 条待处理</span></div>" +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>产生时间</th><th>级别</th><th>告警内容</th><th>触发值 / 阈值</th><th>来源</th><th>状态</th><th>操作</th></tr></thead>' +
      '<tbody id="instanceAlarmBody">' + Cloud.pages.helpers.alarmTable(alarms, { showInstance: false }) +
      '<tr id="instanceAlarmEmptyRow" hidden><td colspan="7">' + ui.emptyState("暂无告警", "该实例当前没有匹配的事件", "check-circle") + "</td></tr>" +
      "</tbody></table></div>" +
      '<div class="table-footer"><span>共 <b id="instanceAlarmFooter">' + alarms.length + "</b> 条记录</span><span class=\"muted\">告警仅存储在本机</span></div></section>";

    return content;
  }

  function detailConfig(instance) {
    var modeLabel = instance.simMode === "manual" ? "手动调节" : "自动模拟";
    var content = '<div class="config-layout">' +
      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>实例阈值策略</h2><p>仅应用于当前实例，保存后立即生效</p></div>' +
          '<span class="tag tag--blue">LOCAL POLICY</span></div>' +
        '<div class="card-body">' +
          '<form id="instanceThresholdForm" data-form="instance-thresholds" data-instance="' + e(instance.id) + '">' +
            '<div class="form-grid form-grid--threshold">' + h.thresholdInputs(instance.thresholds, "instance") + "</div>" +
            '<p class="form-error" id="instanceThresholdError"></p>' +
            '<div class="form-actions">' +
              '<button class="btn btn--primary" type="submit">' + util.icon("check-circle") + "<span>保存阈值</span></button>" +
              '<button class="btn btn--secondary" type="button" data-action="reset-instance-thresholds" data-instance="' + e(instance.id) + '">' +
                util.icon("rotate") + "<span>恢复全局默认</span></button>" +
            "</div>" +
          "</form>" +
          '<div class="form-note">' + util.icon("info") + "<span>正常下限必须大于预警下限。阈值保存在本机浏览器存储中，不上传任何服务器。</span></div>" +
        "</div>" +
      "</section>" +

      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>模拟数据控制</h2><p>当前：' + e(modeLabel) + "</p></div>" +
          '<span class="tag tag--' + (instance.simMode === "manual" ? "orange" : "green") + '">' + e(modeLabel) + "</span></div>" +
        '<div class="card-body">' +
          '<div class="sim-control-block">' +
            '<div class="sim-control-row"><span>自动刷新</span>' + ui.switchControl("configAutoRefresh", data.settings.autoRefresh) + "</div>" +
            '<div class="sim-control-row"><span>采样间隔</span><select class="select select--sm" id="configInterval">' +
              [1000, 2000, 5000].map(function (ms) {
                return '<option value="' + ms + '"' + (data.settings.intervalMs === ms ? " selected" : "") + ">" + ms / 1000 + " 秒</option>";
              }).join("") + "</select></div>" +
            '<div class="sim-control-row"><span>当前工况</span><strong>' + e(instance.scenario === "normal" ? "正常" : instance.scenario === "warning" ? "预警" : "故障") + "</strong></div>" +
            '<div class="sim-control-row"><span>数据来源</span><strong>本机模拟器</strong></div>' +
          "</div>" +
          '<div class="quick-scenarios"><span>快捷工况</span><div>' +
            '<button class="btn btn--xs btn--secondary" type="button" data-action="quick-scenario" data-instance="' + e(instance.id) + '" data-value="normal">正常运行</button>' +
            '<button class="btn btn--xs btn--secondary" type="button" data-action="quick-scenario" data-instance="' + e(instance.id) + '" data-value="warning">预警</button>' +
            '<button class="btn btn--xs btn--danger-ghost" type="button" data-action="quick-scenario" data-instance="' + e(instance.id) + '" data-value="fault">故障</button>' +
          "</div></div>" +
          '<button class="btn btn--primary btn--block" type="button" data-action="open-sim" data-instance="' + e(instance.id) + '">' +
            util.icon("sliders") + "<span>打开模拟数据控制台</span></button>" +
          '<p class="form-note form-note--plain">手动模式支持直接拖动四项指标滑块，健康度会实时重算。</p>' +
        "</div>" +
      "</section>" +

      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>设备档案</h2><p>本地资产信息</p></div>' + util.icon("server", "card-head__icon") + "</div>" +
        '<div class="card-body"><dl class="description-list">' +
          '<div><dt>设备型号</dt><dd>' + e(instance.model) + "</dd></div>" +
          '<div><dt>生产厂家</dt><dd>' + e(instance.manufacturer) + "</dd></div>" +
          '<div><dt>冷却方式</dt><dd>' + e(instance.cooling) + "</dd></div>" +
          '<div><dt>采集端点</dt><dd class="mono">' + e(instance.endpoint) + "</dd></div>" +
          '<div><dt>资产标签</dt><dd>' + instance.tags.map(function (tag) { return ui.tag(tag, "neutral"); }).join(" ") + "</dd></div>" +
        "</dl></div>" +
      "</section>" +

      '<section class="card">' +
        '<div class="card-head"><div class="card-head__title"><h2>采集通道</h2><p>本机虚拟总线</p></div><span class="tag tag--green">在线</span></div>' +
        '<div class="card-body"><div class="channel-info">' +
          '<div><span>通道名称</span><strong>' + e(instance.collector) + "</strong></div>" +
          '<div><span>采集方式</span><strong>' + e(instance.collection) + "</strong></div>" +
          '<div><span>数据延迟</span><strong>2 ms</strong></div>' +
          '<div><span>最近同步</span><strong>' + h.liveUpdated(instance) + "</strong></div>" +
        "</div></div>" +
      "</section>" +
    "</div>";

    return content;
  }

  function buildMetricChart(instance, metric, range, canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var meta = metric === "health" ? null : util.metricMeta(metric);
    var series = data.getSeries(instance.id, metric, range);
    var thresholds = metric === "health"
      ? [
          { value: instance.thresholds.normalLower, color: "#ff8f1f" },
          { value: instance.thresholds.warningLower, color: "#f53f3f" }
        ]
      : [{ value: instance.thresholds[meta.thresholdKey], color: "#ff8f1f" }];
    var color = metric === "health" ? util.stateTheme(instance.status).color : meta.color;
    var chart = Cloud.charts.create(canvas, {
      labels: series.labels,
      unit: metric === "health" ? "分" : meta.unit,
      decimals: 1,
      yMin: 0,
      yMax: metric === "health" ? 100 : (metric === "vibration" ? 8 : metric === "partialDischarge" ? 100 : 110),
      series: [{ name: metric === "health" ? "健康度" : meta.fullLabel, values: series.values, color: color, fill: metric === "health", width: 2 }],
      thresholds: thresholds
    });
    var refresh = function () {
      var current = data.getInstance(instance.id);
      if (!current) return;
      var next = data.getSeries(instance.id, metric, range);
      var nextColor = metric === "health" ? util.stateTheme(current.status).color : meta.color;
      chart.update({
        labels: next.labels,
        series: [{ name: metric === "health" ? "健康度" : meta.fullLabel, values: next.values, color: nextColor, fill: metric === "health", width: 2 }]
      });
    };
    return { chart: chart, refresh: refresh };
  }

  function mount(route, instance) {
    var charts = [];
    if (route.tab === "overview") {
      var detail = buildMetricChart(instance, "health", filters.detailRange, "detailHealthChart");
      if (detail) charts.push(detail);
    } else if (route.tab === "monitor") {
      ["oilTemp", "load", "vibration", "partialDischarge", "health"].forEach(function (metric) {
        var item = buildMetricChart(instance, metric, filters.monitorRange, "monitorChart-" + metric);
        if (item) charts.push(item);
      });
    } else if (route.tab === "health") {
      var health = buildMetricChart(instance, "health", filters.healthRange, "healthTrendChart");
      if (health) charts.push(health);
    }
    return charts;
  }

  Cloud.pages.instance = function (route) {
    var instance = data.getInstance(route.instanceId);
    if (!instance) return Cloud.pages.notFound();
    var tab = route.tab || "overview";
    var body = "";
    if (tab === "overview") body = detailOverview(instance);
    else if (tab === "monitor") body = detailMonitor(instance);
    else if (tab === "health") body = detailHealth(instance);
    else if (tab === "alarms") body = detailAlarms(instance);
    else if (tab === "config") body = detailConfig(instance);
    else body = detailOverview(instance);
    return h.detailHeader(instance, tab) + '<div class="tab-content tab-content--' + e(tab) + '">' + body + "</div>";
  };

  Cloud.pages.instanceMount = mount;
})(window);
