/*
 * 变压器离线运维控制台 · 数据与模拟引擎
 * ------------------------------------------------------------
 * 所有数据均在本机内存中生成，配置持久化到 localStorage。
 * 不存在任何网络请求，也不依赖真实传感器。
 */
(function (global) {
  "use strict";

  var Cloud = (global.Cloud = global.Cloud || {});
  var util = Cloud.util;

  var STORAGE_KEY = "transformer-offline-console.v2";
  var MAX_HISTORY = 240;

  var DEFAULT_THRESHOLDS = {
    normalLower: 78,
    warningLower: 45,
    oilAlarm: 85,
    vibrationAlarm: 3.5,
    partialDischargeAlarm: 50,
    loadAlarm: 95
  };

  var PROFILES = {
    normal: { oilTemp: 54.9, load: 75.6, vibration: 0.6, partialDischarge: 36.1 },
    warning: { oilTemp: 70.2, load: 85.2, vibration: 2.2, partialDischarge: 43.0 },
    fault: { oilTemp: 83.9, load: 92.3, vibration: 4.3, partialDischarge: 49.2 }
  };

  var INSTANCE_SEEDS = [
    {
      id: "TR-220-001",
      code: "T-01",
      name: "1号主变压器",
      shortName: "1号主变",
      location: "南京 · 江北本地机房 A",
      zone: "1F · 主变室 01",
      voltage: "220 kV",
      capacity: "180 MVA",
      model: "SFZ11-180000/220",
      cooling: "ONAN / ONAF",
      manufacturer: "特变电工",
      commissioned: "2018-06-12",
      lastOverhaul: "2025-11-08",
      collector: "LOCAL-EDGE-01",
      endpoint: "sim://local/t01",
      collection: "本机模拟 · 4 通道",
      agingPenalty: 4.9,
      scenario: "normal",
      metrics: { oilTemp: 54.9, load: 75.6, vibration: 0.6, partialDischarge: 36.1 },
      locationCode: "LOCAL-A",
      tags: ["主变", "A级重点"],
      operator: "变电运维一班"
    },
    {
      id: "TR-220-002",
      code: "T-02",
      name: "2号主变压器",
      shortName: "2号主变",
      location: "南京 · 江北本地机房 B",
      zone: "1F · 主变室 02",
      voltage: "220 kV",
      capacity: "180 MVA",
      model: "SFZ11-180000/220",
      cooling: "ONAN / ONAF",
      manufacturer: "特变电工",
      commissioned: "2017-08-25",
      lastOverhaul: "2024-12-19",
      collector: "LOCAL-EDGE-02",
      endpoint: "sim://local/t02",
      collection: "本机模拟 · 4 通道",
      agingPenalty: 0.4,
      scenario: "warning",
      metrics: { oilTemp: 70.2, load: 85.2, vibration: 2.2, partialDischarge: 43.0 },
      locationCode: "LOCAL-B",
      tags: ["主变", "重点关注"],
      operator: "变电运维二班"
    },
    {
      id: "TR-110-003",
      code: "T-03",
      name: "1号高备变压器",
      shortName: "1号高备变",
      location: "南京 · 江北本地机房 A",
      zone: "2F · 高压室 03",
      voltage: "110 kV",
      capacity: "63 MVA",
      model: "SSZ11-63000/110",
      cooling: "ONAN / ONAF",
      manufacturer: "保变电气",
      commissioned: "2020-03-18",
      lastOverhaul: "2026-01-14",
      collector: "LOCAL-EDGE-03",
      endpoint: "sim://local/t03",
      collection: "本机模拟 · 4 通道",
      agingPenalty: 2.4,
      scenario: "normal",
      metrics: { oilTemp: 52.8, load: 71.4, vibration: 0.5, partialDischarge: 33.8 },
      locationCode: "LOCAL-A",
      tags: ["高备变"],
      operator: "变电运维一班"
    },
    {
      id: "TR-035-004",
      code: "T-04",
      name: "站用变压器",
      shortName: "站用变",
      location: "南京 · 江北本地机房 A",
      zone: "1F · 配电室 02",
      voltage: "35 kV",
      capacity: "20 MVA",
      model: "S11-20000/35",
      cooling: "ONAN",
      manufacturer: "西电电气",
      commissioned: "2015-04-06",
      lastOverhaul: "2024-05-21",
      collector: "LOCAL-EDGE-04",
      endpoint: "sim://local/t04",
      collection: "本机模拟 · 4 通道",
      agingPenalty: 0.4,
      scenario: "fault",
      metrics: { oilTemp: 83.9, load: 92.3, vibration: 4.3, partialDischarge: 49.2 },
      locationCode: "LOCAL-A",
      tags: ["站用变", "异常"],
      operator: "变电运维三班"
    },
    {
      id: "TR-110-005",
      code: "T-05",
      name: "2号高备变压器",
      shortName: "2号高备变",
      location: "南京 · 江北本地机房 B",
      zone: "2F · 高压室 04",
      voltage: "110 kV",
      capacity: "63 MVA",
      model: "SSZ11-63000/110",
      cooling: "ONAN / ONAF",
      manufacturer: "保变电气",
      commissioned: "2014-11-30",
      lastOverhaul: "2026-02-02",
      collector: "LOCAL-EDGE-05",
      endpoint: "sim://local/t05",
      collection: "本机模拟 · 4 通道",
      agingPenalty: 23.3,
      scenario: "normal",
      metrics: { oilTemp: 41.2, load: 28.4, vibration: 0.3, partialDischarge: 31.2 },
      locationCode: "LOCAL-B",
      tags: ["高备变", "检修"],
      operator: "变电运维二班",
      lifecycle: "maintenance",
      maintenanceUntil: "2026-11-18 18:00"
    }
  ];

  function normalizeThresholds(input) {
    var source = input || {};
    var output = {};
    util.THRESHOLD_DEFS.forEach(function (def) {
      var raw = Number(source[def.key]);
      if (!Number.isFinite(raw)) raw = DEFAULT_THRESHOLDS[def.key];
      output[def.key] = util.round(util.clamp(raw, def.min, def.max), def.decimals);
    });
    if (output.warningLower >= output.normalLower) {
      output.warningLower = Math.max(10, output.normalLower - 1);
    }
    return output;
  }

  function readStore() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStore(value) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      /* 忽略隐私模式或存储不可用 */
    }
  }

  function metricPenalty(metrics) {
    var oil = Math.max(0, metrics.oilTemp - 50) * 0.9;
    var load = Math.max(0, metrics.load - 60) * 0.25;
    var vibration = Math.max(0, metrics.vibration - 0.4) * 4;
    var discharge = Math.max(0, metrics.partialDischarge - 20) * 0.22;
    return {
      oil: util.round(oil, 2),
      load: util.round(load, 2),
      vibration: util.round(vibration, 2),
      partialDischarge: util.round(discharge, 2),
      total: util.round(oil + load + vibration + discharge, 2)
    };
  }

  function calculateHealth(metrics, agingPenalty) {
    var penalties = metricPenalty(metrics);
    return util.round(util.clamp(100 - penalties.total - (agingPenalty || 0), 0, 100), 1);
  }

  function calculateConfidence(health, status) {
    var base = 98.4 - health * 0.073;
    if (status === "fault") base += 0.6;
    return util.round(util.clamp(base, 91.2, 98.2), 1);
  }

  function calculateRemainingLife(health) {
    return Math.max(3, Math.round(health * 0.9));
  }

  function buildRiskFactors(metrics) {
    var penalties = metricPenalty(metrics);
    var total = Math.max(0.1, penalties.total);
    var definitions = [
      { key: "oil", metric: "oilTemp", label: "油温贡献", weight: penalties.oil },
      { key: "load", metric: "load", label: "负载贡献", weight: penalties.load },
      { key: "vibration", metric: "vibration", label: "振动贡献", weight: penalties.vibration },
      { key: "partialDischarge", metric: "partialDischarge", label: "局放贡献", weight: penalties.partialDischarge }
    ];
    var factors = definitions.map(function (item) {
      return Object.assign({}, item, {
        percent: Math.round((item.weight / total) * 100),
        weight: util.round(item.weight, 2)
      });
    });
    var percentTotal = factors.reduce(function (sum, item) { return sum + item.percent; }, 0);
    if (penalties.total > 0 && percentTotal !== 100 && factors.length) {
      factors.sort(function (a, b) { return b.weight - a.weight; });
      factors[0].percent += 100 - percentTotal;
    }
    return factors.sort(function (a, b) {
      return b.weight - a.weight;
    });
  }

  function deriveStatus(health, metrics, thresholds, lifecycle) {
    if (lifecycle === "maintenance" || lifecycle === "offline") return "maintenance";
    var status = "normal";
    if (health < thresholds.warningLower) status = "fault";
    else if (health < thresholds.normalLower) status = "warning";

    var sensorAlarm =
      metrics.oilTemp >= thresholds.oilAlarm ||
      metrics.vibration >= thresholds.vibrationAlarm ||
      metrics.partialDischarge >= thresholds.partialDischargeAlarm ||
      metrics.load >= thresholds.loadAlarm;

    if (sensorAlarm && status === "normal") status = "warning";
    return status;
  }

  function nowTime() {
    return Date.now();
  }

  function Simulation(seed) {
    this.listeners = [];
    this.timer = null;
    this.lastTick = 0;
    this._inspectionTimers = {};
    this.persisted = readStore() || {};
    this.settings = Object.assign({
      autoRefresh: true,
      intervalMs: 2000,
      sidebarCollapsed: false,
      activeTab: "overview"
    }, this.persisted.settings || {});
    this.settings.intervalMs = [1000, 2000, 5000].indexOf(Number(this.settings.intervalMs)) >= 0
      ? Number(this.settings.intervalMs)
      : 2000;

    this.defaultThresholds = normalizeThresholds(
      Object.assign({}, DEFAULT_THRESHOLDS, this.persisted.defaultThresholds || {})
    );
    this._buildFromSeeds();
  }

  Simulation.prototype._buildFromSeeds = function () {
    var self = this;
    var storedThresholds = this.persisted.thresholds || {};
    var storedAlarmState = this.persisted.alarmState || {};
    var now = nowTime();

    this.instances = INSTANCE_SEEDS.map(function (seed) {
      var instance = Object.assign({}, seed, {
        metrics: Object.assign({}, seed.metrics),
        previousMetrics: Object.assign({}, seed.metrics),
        thresholds: normalizeThresholds(storedThresholds[seed.id] || self.defaultThresholds),
        simMode: "auto",
        online: seed.lifecycle !== "offline",
        lastUpdated: now - 800,
        history: []
      });
      instance.status = seed.lifecycle === "maintenance" ? "maintenance" : "normal";
      self._derive(instance);
      instance.previousStatus = instance.status;
      instance.metricAlarmState = {
        oilAlarm: instance.metrics.oilTemp >= instance.thresholds.oilAlarm,
        vibrationAlarm: instance.metrics.vibration >= instance.thresholds.vibrationAlarm,
        partialDischargeAlarm: instance.metrics.partialDischarge >= instance.thresholds.partialDischargeAlarm,
        loadAlarm: instance.metrics.load >= instance.thresholds.loadAlarm
      };
      self._seedHistory(instance);
      return instance;
    });

    this.alarms = this._seedAlarms();
    this.alarms.forEach(function (alarm) {
      var state = storedAlarmState[alarm.id];
      if (!state) return;
      alarm.read = Boolean(state.read);
      if (state.status === "acknowledged") {
        alarm.status = "acknowledged";
        alarm.acknowledgedAt = state.acknowledgedAt || Date.now();
        alarm.acknowledgedBy = state.acknowledgedBy || "运维管理员";
      }
    });

    this.tasks = this._seedTasks();
    this.nodes = this._seedNodes();
    this.lastTick = now;
  };

  Simulation.prototype._seedHistory = function (instance) {
    var self = this;
    var now = nowTime();
    var interval = this.settings.intervalMs;
    var points = 120;
    var seedValue = util.hashString(instance.id + "-history");
    var random = util.seededRandom(seedValue);
    var sample = {
      oilTemp: instance.metrics.oilTemp,
      load: instance.metrics.load,
      vibration: instance.metrics.vibration,
      partialDischarge: instance.metrics.partialDischarge
    };
    var series = [];
    var current = Object.assign({}, sample);

    for (var i = points - 1; i >= 0; i -= 1) {
      var wave = Math.sin((points - i) * 0.28 + (seedValue % 7));
      var oil = instance.metrics.oilTemp + wave * 0.65 + (random() - 0.5) * 1.1;
      var load = instance.metrics.load + Math.sin((points - i) * 0.17) * 1.8 + (random() - 0.5) * 2.4;
      var vibration = Math.max(0.1, instance.metrics.vibration + wave * 0.08 + (random() - 0.5) * 0.14);
      var discharge = Math.max(1, instance.metrics.partialDischarge + Math.sin((points - i) * 0.22) * 1.2 + (random() - 0.5) * 2);
      var health = instance.lifecycle === "maintenance"
        ? instance.health
        : calculateHealth({
          oilTemp: oil,
          load: load,
          vibration: vibration,
          partialDischarge: discharge
        }, instance.agingPenalty);
      series.push({
        t: now - i * interval,
        oilTemp: util.round(oil, 1),
        load: util.round(util.clamp(load, 0, 110), 1),
        vibration: util.round(vibration, 2),
        partialDischarge: util.round(discharge, 1),
        health: health
      });
    }
    series[series.length - 1] = {
      t: now,
      oilTemp: instance.metrics.oilTemp,
      load: instance.metrics.load,
      vibration: instance.metrics.vibration,
      partialDischarge: instance.metrics.partialDischarge,
      health: instance.health
    };
    instance.history = series;
  };

  Simulation.prototype._seedAlarms = function () {
    var now = nowTime();
    return [
      {
        id: "ALM-2401",
        instanceId: "TR-035-004",
        severity: "critical",
        category: "振动超限",
        metric: "vibration",
        message: "本体振动超过严重告警阈值，疑似绕组松动",
        triggerValue: 4.3,
        threshold: 3.5,
        unit: "mm/s",
        source: "阈值规则",
        createdAt: now - 3 * 60 * 1000,
        status: "open",
        read: false
      },
      {
        id: "ALM-2402",
        instanceId: "TR-220-002",
        severity: "warning",
        category: "油温上升",
        metric: "oilTemp",
        message: "顶层油温连续 3 个采样周期上升，建议检查冷却系统",
        triggerValue: 70.2,
        threshold: 85,
        unit: "°C",
        source: "趋势检测",
        createdAt: now - 12 * 60 * 1000,
        status: "open",
        read: false
      },
      {
        id: "ALM-2403",
        instanceId: "TR-035-004",
        severity: "critical",
        category: "局放异常",
        metric: "partialDischarge",
        message: "局部放电幅值突增，达到严重关注等级",
        triggerValue: 52.8,
        threshold: 50,
        unit: "pC",
        source: "阈值规则",
        createdAt: now - 31 * 60 * 1000,
        status: "open",
        read: false
      },
      {
        id: "ALM-2404",
        instanceId: "TR-220-001",
        severity: "warning",
        category: "冷却效率",
        metric: "oilTemp",
        message: "冷却风机效率低于同工况基线，建议例行检查",
        triggerValue: 1.8,
        threshold: 2.4,
        unit: "m/s",
        source: "能效模型",
        createdAt: now - 58 * 60 * 1000,
        status: "acknowledged",
        read: true,
        acknowledgedAt: now - 42 * 60 * 1000,
        acknowledgedBy: "运维管理员"
      },
      {
        id: "ALM-2405",
        instanceId: "TR-110-003",
        severity: "info",
        category: "巡检完成",
        metric: "health",
        message: "例行巡检完成，未发现新增异常",
        triggerValue: 88.8,
        threshold: 78,
        unit: "分",
        source: "本地巡检",
        createdAt: now - 2 * 60 * 60 * 1000,
        status: "acknowledged",
        read: true,
        acknowledgedAt: now - 2 * 60 * 60 * 1000 + 24000,
        acknowledgedBy: "系统自动"
      }
    ];
  };

  Simulation.prototype._seedTasks = function () {
    var now = nowTime();
    return [
      {
        id: "INS-1001",
        name: "主变例行巡检",
        targets: "T-01、T-02",
        schedule: "每日 08:00",
        mode: "本地自动",
        status: "success",
        lastRun: now - 2 * 60 * 60 * 1000,
        duration: "38 秒",
        summary: "2 台设备、8 项指标检查完成",
        findings: 1,
        nextRun: now + 22 * 60 * 60 * 1000
      },
      {
        id: "INS-1002",
        name: "油温与冷却系统专项检查",
        targets: "T-02",
        schedule: "每 6 小时",
        mode: "本地自动",
        status: "success",
        lastRun: now - 47 * 60 * 1000,
        duration: "21 秒",
        summary: "发现 1 项冷却效率偏差，已生成告警",
        findings: 1,
        nextRun: now + 5.2 * 60 * 60 * 1000
      },
      {
        id: "INS-1003",
        name: "全量局放采样复核",
        targets: "全部在线实例",
        schedule: "每周一 09:30",
        mode: "手动触发",
        status: "idle",
        lastRun: now - 3 * 24 * 60 * 60 * 1000,
        duration: "54 秒",
        summary: "上次巡检未见异常",
        findings: 0,
        nextRun: now + 4 * 24 * 60 * 60 * 1000
      },
      {
        id: "INS-1004",
        name: "高备变绝缘数据核查",
        targets: "T-03、T-05",
        schedule: "每周五 14:00",
        mode: "本地自动",
        status: "idle",
        lastRun: now - 5 * 24 * 60 * 60 * 1000,
        duration: "44 秒",
        summary: "历史数据完整率 99.9%",
        findings: 0,
        nextRun: now + 2 * 24 * 60 * 60 * 1000
      }
    ];
  };

  Simulation.prototype._seedNodes = function () {
    var now = nowTime();
    return [
      { id: "LOCAL-EDGE-01", name: "1号主变采集通道", instanceId: "TR-220-001", protocol: "本机模拟 / 4 通道", status: "online", latency: 2, packets: 128420, lastSync: now - 900, version: "sim-2.0.1" },
      { id: "LOCAL-EDGE-02", name: "2号主变采集通道", instanceId: "TR-220-002", protocol: "本机模拟 / 4 通道", status: "online", latency: 1, packets: 127885, lastSync: now - 1200, version: "sim-2.0.1" },
      { id: "LOCAL-EDGE-03", name: "1号高备变采集通道", instanceId: "TR-110-003", protocol: "本机模拟 / 4 通道", status: "online", latency: 3, packets: 126040, lastSync: now - 1600, version: "sim-2.0.1" },
      { id: "LOCAL-EDGE-04", name: "站用变采集通道", instanceId: "TR-035-004", protocol: "本机模拟 / 4 通道", status: "online", latency: 2, packets: 124771, lastSync: now - 2200, version: "sim-2.0.1" },
      { id: "LOCAL-EDGE-05", name: "2号高备变采集通道", instanceId: "TR-110-005", protocol: "本机模拟 / 4 通道", status: "standby", latency: 0, packets: 98314, lastSync: now - 3600000, version: "sim-2.0.1" }
    ];
  };

  Simulation.prototype._derive = function (instance) {
    var metrics = instance.metrics;
    var health = instance.lifecycle === "maintenance"
      ? 74.6
      : calculateHealth(metrics, instance.agingPenalty);
    var status = deriveStatus(health, metrics, instance.thresholds, instance.lifecycle);
    instance.health = health;
    instance.status = status;
    instance.confidence = calculateConfidence(health, status);
    instance.remainingLifeDays = calculateRemainingLife(health);
    instance.riskFactors = buildRiskFactors(metrics);
    instance.healthDelta = util.round(health - (instance.previousHealth === undefined ? health : instance.previousHealth), 1);
    instance.previousHealth = health;
    instance.deltas = {
      oilTemp: util.round(metrics.oilTemp - instance.previousMetrics.oilTemp, 1),
      load: util.round(metrics.load - instance.previousMetrics.load, 1),
      vibration: util.round(metrics.vibration - instance.previousMetrics.vibration, 1),
      partialDischarge: util.round(metrics.partialDischarge - instance.previousMetrics.partialDischarge, 1)
    };
  };

  Simulation.prototype._pushHistory = function (instance) {
    var point = {
      t: instance.lastUpdated,
      oilTemp: instance.metrics.oilTemp,
      load: instance.metrics.load,
      vibration: instance.metrics.vibration,
      partialDischarge: instance.metrics.partialDischarge,
      health: instance.health
    };
    instance.history.push(point);
    if (instance.history.length > MAX_HISTORY) instance.history.shift();
  };

  Simulation.prototype._advanceAuto = function (instance) {
    var profile = PROFILES[instance.scenario] || PROFILES.normal;
    var now = Date.now() / 1000;
    var phase = (util.hashString(instance.id) % 100) / 10;
    var values = instance.metrics;

    values.oilTemp += (profile.oilTemp - values.oilTemp) * 0.3 +
      Math.sin(now / 24 + phase) * 0.23 + (Math.random() - 0.5) * 0.16;
    values.load += (profile.load - values.load) * 0.3 +
      Math.sin(now / 31 + phase * 0.7) * 0.6 + (Math.random() - 0.5) * 0.42;
    values.vibration += (profile.vibration - values.vibration) * 0.32 +
      Math.sin(now / 18 + phase * 1.2) * 0.035 + (Math.random() - 0.5) * 0.03;
    values.partialDischarge += (profile.partialDischarge - values.partialDischarge) * 0.28 +
      Math.sin(now / 27 + phase * 0.4) * 0.4 + (Math.random() - 0.5) * 0.3;

    values.oilTemp = util.round(util.clamp(values.oilTemp, 20, 120), 1);
    values.load = util.round(util.clamp(values.load, 0, 110), 1);
    values.vibration = util.round(Math.max(0, values.vibration), 2);
    values.partialDischarge = util.round(Math.max(0, values.partialDischarge), 1);
  };

  Simulation.prototype._checkAlarms = function (instance, previousMetrics) {
    var thresholds = instance.thresholds;
    var checks = [
      { key: "oilTemp", stateKey: "oilAlarm", threshold: thresholds.oilAlarm, category: "油温超限", severity: "warning", unit: "°C" },
      { key: "vibration", stateKey: "vibrationAlarm", threshold: thresholds.vibrationAlarm, category: "振动超限", severity: "critical", unit: "mm/s" },
      { key: "partialDischarge", stateKey: "partialDischargeAlarm", threshold: thresholds.partialDischargeAlarm, category: "局放超限", severity: "critical", unit: "pC" },
      { key: "load", stateKey: "loadAlarm", threshold: thresholds.loadAlarm, category: "负载超限", severity: "warning", unit: "%" }
    ];

    checks.forEach(function (check) {
      var before = Number(previousMetrics[check.key]) >= check.threshold;
      var after = Number(instance.metrics[check.key]) >= check.threshold;
      if (!before && after) {
        this.addAlarm({
          instanceId: instance.id,
          severity: check.severity,
          category: check.category,
          metric: check.key,
          message: check.category + "，当前值 " + instance.metrics[check.key] + check.unit + "，阈值 " + check.threshold + check.unit,
          triggerValue: instance.metrics[check.key],
          threshold: check.threshold,
          unit: check.unit,
          source: "阈值规则"
        });
      }
    }, this);

    if (instance.previousStatus !== instance.status) {
      if (instance.status === "fault") {
        this.addAlarm({
          instanceId: instance.id,
          severity: "critical",
          category: "健康度跌至故障阈值",
          metric: "health",
          message: "AI 健康评估已低于故障下限，请立即安排检修",
          triggerValue: instance.health,
          threshold: instance.thresholds.warningLower,
          unit: "分",
          source: "健康模型"
        });
      } else if (instance.status === "warning") {
        this.addAlarm({
          instanceId: instance.id,
          severity: "warning",
          category: "健康度进入预警区间",
          metric: "health",
          message: "AI 健康评估低于正常下限，建议关注负载与温升趋势",
          triggerValue: instance.health,
          threshold: instance.thresholds.normalLower,
          unit: "分",
          source: "健康模型"
        });
      }
    }
  };

  Simulation.prototype.addAlarm = function (input) {
    var now = nowTime();
    var duplicate = this.alarms.some(function (alarm) {
      return alarm.instanceId === input.instanceId &&
        alarm.category === input.category &&
        alarm.status === "open" &&
        now - alarm.createdAt < 5 * 60 * 1000;
    });
    if (duplicate) return null;

    var alarm = Object.assign({
      id: util.uid("ALM"),
      severity: "warning",
      source: "本地模拟",
      createdAt: now,
      status: "open",
      read: false,
      unit: ""
    }, input);
    this.alarms.unshift(alarm);
    if (this.alarms.length > 120) this.alarms.length = 120;
    this._persist();
    this.emit("alarm", alarm);
    return alarm;
  };

  Simulation.prototype.acknowledgeAlarm = function (id) {
    var alarm = this.alarms.find(function (item) { return item.id === id; });
    if (!alarm || alarm.status === "acknowledged") return false;
    alarm.status = "acknowledged";
    alarm.read = true;
    alarm.acknowledgedAt = nowTime();
    alarm.acknowledgedBy = "运维管理员";
    this._persist();
    this.emit("alarm-updated", alarm);
    return true;
  };

  Simulation.prototype.acknowledgeAll = function (instanceId) {
    var count = 0;
    this.alarms.forEach(function (alarm) {
      if (alarm.status !== "open") return;
      if (instanceId && alarm.instanceId !== instanceId) return;
      alarm.status = "acknowledged";
      alarm.read = true;
      alarm.acknowledgedAt = nowTime();
      alarm.acknowledgedBy = "运维管理员";
      count += 1;
    });
    if (count) {
      this._persist();
      this.emit("alarm-updated", null);
    }
    return count;
  };

  Simulation.prototype.markNotificationRead = function (id) {
    var alarm = this.alarms.find(function (item) { return item.id === id; });
    if (!alarm || alarm.read) return;
    alarm.read = true;
    this._persist();
    this.emit("notifications", alarm);
  };

  Simulation.prototype.markAllNotificationsRead = function () {
    var changed = false;
    this.alarms.forEach(function (alarm) {
      if (!alarm.read) {
        alarm.read = true;
        changed = true;
      }
    });
    if (changed) {
      this._persist();
      this.emit("notifications", null);
    }
  };

  Simulation.prototype.getAlarms = function (options) {
    options = options || {};
    return this.alarms
      .filter(function (alarm) {
        if (options.instanceId && alarm.instanceId !== options.instanceId) return false;
        if (options.severity && options.severity !== "all" && alarm.severity !== options.severity) return false;
        if (options.status && options.status !== "all" && alarm.status !== options.status) return false;
        if (options.query) {
          var text = (alarm.category + " " + alarm.message + " " + alarm.instanceId).toLowerCase();
          if (text.indexOf(options.query.toLowerCase()) < 0) return false;
        }
        return true;
      })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  };

  Simulation.prototype.getAlarmCounts = function (instanceId) {
    var scoped = instanceId
      ? this.alarms.filter(function (alarm) { return alarm.instanceId === instanceId; })
      : this.alarms;
    return {
      total: scoped.length,
      open: scoped.filter(function (alarm) { return alarm.status === "open"; }).length,
      critical: scoped.filter(function (alarm) { return alarm.status === "open" && alarm.severity === "critical"; }).length,
      warning: scoped.filter(function (alarm) { return alarm.status === "open" && alarm.severity === "warning"; }).length,
      info: scoped.filter(function (alarm) { return alarm.status === "open" && alarm.severity === "info"; }).length,
      unread: scoped.filter(function (alarm) { return !alarm.read; }).length,
      acknowledged: scoped.filter(function (alarm) { return alarm.status === "acknowledged"; }).length
    };
  };

  Simulation.prototype.getUnreadCount = function () {
    return this.alarms.filter(function (alarm) { return !alarm.read; }).length;
  };

  Simulation.prototype.getRecentAlarms = function (limit, instanceId) {
    return this.getAlarms({ instanceId: instanceId }).slice(0, limit || 5);
  };

  Simulation.prototype.getStats = function () {
    var self = this;
    var counts = { normal: 0, warning: 0, fault: 0, maintenance: 0 };
    this.instances.forEach(function (instance) {
      counts[instance.status] = (counts[instance.status] || 0) + 1;
    });
    var online = this.instances.filter(function (instance) { return instance.lifecycle !== "offline"; });
    var active = this.instances.filter(function (instance) { return instance.status !== "maintenance"; });
    var avgHealth = active.length
      ? active.reduce(function (sum, instance) { return sum + instance.health; }, 0) / active.length
      : 0;
    var openAlarms = this.getAlarmCounts().open;
    return {
      total: this.instances.length,
      online: online.length,
      normal: counts.normal,
      warning: counts.warning,
      fault: counts.fault,
      maintenance: counts.maintenance,
      healthyRate: this.instances.length ? Math.round((counts.normal / this.instances.length) * 100) : 0,
      averageHealth: util.round(avgHealth, 1),
      openAlarms: openAlarms,
      unreadAlarms: this.getUnreadCount(),
      lastTick: this.lastTick
    };
  };

  Simulation.prototype.getInstance = function (id) {
    return this.instances.find(function (instance) { return instance.id === id; }) || null;
  };

  Simulation.prototype.getThresholds = function (id) {
    var instance = this.getInstance(id);
    return Object.assign({}, instance ? instance.thresholds : this.defaultThresholds);
  };

  Simulation.prototype.setThresholds = function (id, values) {
    var instance = this.getInstance(id);
    if (!instance) return false;
    instance.thresholds = normalizeThresholds(values);
    this._derive(instance);
    this._persist();
    this.emit("settings", { instanceId: id });
    return true;
  };

  Simulation.prototype.setAllThresholds = function (values) {
    var normalized = normalizeThresholds(values);
    this.defaultThresholds = Object.assign({}, normalized);
    this.instances.forEach(function (instance) {
      instance.thresholds = Object.assign({}, normalized);
    });
    this._deriveAll();
    this._persist();
    this.emit("settings", { all: true });
  };

  Simulation.prototype.resetThresholds = function (id) {
    var instance = this.getInstance(id);
    if (!instance) return;
    instance.thresholds = Object.assign({}, this.defaultThresholds);
    this._derive(instance);
    this._persist();
    this.emit("settings", { instanceId: id });
  };

  Simulation.prototype.setSimMode = function (id, mode) {
    var instance = this.getInstance(id);
    if (!instance) return;
    if (mode !== "manual" && instance.simMode === "manual") {
      instance.scenario = instance.status === "fault" ? "fault" : instance.status === "warning" ? "warning" : "normal";
    }
    instance.simMode = mode === "manual" ? "manual" : "auto";
    this.emit("sim", { instanceId: id });
  };

  Simulation.prototype.setScenario = function (id, scenario) {
    if (!PROFILES[scenario]) return;
    var instance = this.getInstance(id);
    if (!instance) return;
    instance.previousMetrics = Object.assign({}, instance.metrics);
    instance.scenario = scenario;
    instance.simMode = "auto";
    instance.metrics = Object.assign({}, PROFILES[scenario]);
    instance.lastUpdated = nowTime();
    instance.previousStatus = instance.status;
    this._derive(instance);
    this._checkAlarms(instance, instance.previousMetrics);
    this._pushHistory(instance);
    this.emit("sim", { instanceId: id, scenario: scenario });
  };

  Simulation.prototype.setManualMetric = function (id, key, value) {
    var instance = this.getInstance(id);
    if (!instance || !Object.prototype.hasOwnProperty.call(instance.metrics, key)) return;
    var limits = {
      oilTemp: [20, 120],
      load: [0, 110],
      vibration: [0, 8],
      partialDischarge: [0, 100]
    };
    var range = limits[key] || [0, 100];
    instance.previousMetrics = Object.assign({}, instance.metrics);
    instance.metrics[key] = util.round(util.clamp(Number(value) || 0, range[0], range[1]), key === "vibration" ? 2 : 1);
    instance.simMode = "manual";
    instance.lastUpdated = nowTime();
    var previousStatus = instance.status;
    instance.previousStatus = previousStatus;
    this._derive(instance);
    this._checkAlarms(instance, instance.previousMetrics);
    this._pushHistory(instance);
    this.emit("sim", { instanceId: id, manual: true, key: key });
  };

  Simulation.prototype.resetInstanceBaseline = function (id) {
    var instance = this.getInstance(id);
    if (!instance) return;
    var seed = INSTANCE_SEEDS.find(function (item) { return item.id === id; });
    instance.previousMetrics = Object.assign({}, instance.metrics);
    instance.metrics = Object.assign({}, seed.metrics);
    instance.scenario = seed.scenario;
    instance.simMode = "auto";
    instance.lastUpdated = nowTime();
    this._derive(instance);
    this._pushHistory(instance);
    this.emit("sim", { instanceId: id, reset: true });
  };

  Simulation.prototype.getSeries = function (instanceId, metric, range) {
    var instance = this.getInstance(instanceId);
    if (!instance) return { values: [], labels: [], unit: "" };
    range = range || "live";
    var defs = {
      live: { minutes: 4, points: 60 },
      "30m": { minutes: 30, points: 60 },
      "2h": { minutes: 120, points: 60 },
      "24h": { minutes: 1440, points: 72 }
    };
    var def = defs[range] || defs.live;

    if (range === "live") {
      var live = instance.history.slice(-def.points);
      return {
        values: live.map(function (point) { return point[metric]; }),
        labels: live.map(function (point) { return util.formatTime(point.t, true); }),
        unit: metric === "health" ? "分" : util.metricMeta(metric).unit
      };
    }

    var weights = { live: 1, "30m": 1.4, "2h": 2, "24h": 3.1 };
    var amplitudes = { oilTemp: 3.4, load: 5.2, vibration: 0.35, partialDischarge: 3.2, health: 5.4 };
    var weight = weights[range] || 1;
    var amplitude = (amplitudes[metric] || 1) * weight;
    var seed = util.hashString(instance.id + "-" + metric + "-" + range);
    var random = util.seededRandom(seed);
    var profile = instance.scenario === "fault"
      ? PROFILES.fault
      : instance.scenario === "warning" ? PROFILES.warning : PROFILES.normal;
    var base;
    if (metric === "health") {
      base = instance.lifecycle === "maintenance" ? instance.health : calculateHealth(profile, instance.agingPenalty);
    } else {
      base = profile[metric];
    }
    var values = [];
    var current = base + (random() - 0.5) * amplitude * 2;
    for (var i = 0; i < def.points; i += 1) {
      var progress = i / (def.points - 1);
      current += (base - current) * 0.08 + Math.sin(progress * Math.PI * 2.4 + seed % 6) * amplitude * 0.09 + (random() - 0.5) * amplitude * 0.16;
      values.push(current);
    }
    values[values.length - 1] = instance.metrics[metric] !== undefined ? instance.metrics[metric] : instance.health;
    var end = values[values.length - 1];
    var startOffset = end - values[values.length - 2];
    for (var j = 0; j < values.length; j += 1) {
      var upper = metric === "health" || metric === "partialDischarge" ? 100 : metric === "load" || metric === "oilTemp" ? 110 : 8;
      values[j] = util.round(util.clamp(values[j] + startOffset * (j / values.length) * 0.15, 0, upper), 1);
    }
    values[values.length - 1] = util.round(instance.metrics[metric] !== undefined ? instance.metrics[metric] : instance.health, 1);

    var labels = values.map(function (_value, index) {
      var t = Date.now() - def.minutes * 60 * 1000 + (def.minutes * 60 * 1000 * index) / (def.points - 1);
      return util.formatTime(t, false);
    });
    return {
      values: values,
      labels: labels,
      unit: metric === "health" ? "分" : util.metricMeta(metric).unit
    };
  };

  Simulation.prototype.getTasks = function () {
    return this.tasks.slice();
  };

  Simulation.prototype.runInspection = function (id) {
    var self = this;
    var task = this.tasks.find(function (item) { return item.id === id; });
    if (!task || task.status === "running") return Promise.resolve(task);
    task.status = "running";
    task.progress = 0;
    this.emit("inspection", task);

    return new Promise(function (resolve) {
      global.clearTimeout(self._inspectionTimers[id]);
      self._inspectionTimers[id] = global.setTimeout(function () {
        var stats = self.getStats();
        task.status = "success";
        task.lastRun = nowTime();
        task.duration = (12 + Math.round(Math.random() * 25)) + " 秒";
        task.findings = stats.fault > 0 ? 1 : 0;
        task.summary = stats.fault > 0
          ? "发现 " + stats.fault + " 台故障设备，已生成复查建议"
          : "全部在线实例指标检查完成，未发现新增异常";
        task.nextRun = nowTime() + 24 * 60 * 60 * 1000;
        task.progress = 100;
        self.emit("inspection", task);
        resolve(task);
      }, 1700);
    });
  };

  Simulation.prototype.getNodes = function () {
    return this.nodes.map(function (node) {
      return Object.assign({}, node, {
        instance: this.getInstance(node.instanceId)
      });
    }, this);
  };

  Simulation.prototype.setAutoRefresh = function (enabled) {
    this.settings.autoRefresh = Boolean(enabled);
    this._persist();
    if (this.settings.autoRefresh) this.start();
    else this.stop();
    this.emit("settings", { autoRefresh: this.settings.autoRefresh });
  };

  Simulation.prototype.setIntervalMs = function (value) {
    var interval = Number(value);
    if ([1000, 2000, 5000].indexOf(interval) < 0) return;
    this.settings.intervalMs = interval;
    this._persist();
    if (this.timer) {
      this.stop();
      this.start();
    }
    this.emit("settings", { intervalMs: interval });
  };

  Simulation.prototype.setSidebarCollapsed = function (collapsed) {
    this.settings.sidebarCollapsed = Boolean(collapsed);
    this._persist();
  };

  Simulation.prototype.tickNow = function () {
    this._tick(true);
  };

  Simulation.prototype._deriveAll = function () {
    this.instances.forEach(this._derive.bind(this));
  };

  Simulation.prototype._tick = function (force) {
    if (!this.settings.autoRefresh && !force) return;
    var now = nowTime();
    var changed = [];

    this.instances.forEach(function (instance) {
      if (instance.lifecycle === "maintenance" || instance.lifecycle === "offline") {
        instance.lastUpdated = now;
        instance.previousStatus = instance.status;
        return;
      }
      instance.previousMetrics = Object.assign({}, instance.metrics);
      if (instance.simMode === "auto") {
        this._advanceAuto(instance);
      }
      var previousStatus = instance.status;
      instance.previousStatus = previousStatus;
      instance.lastUpdated = now;
      this._derive(instance);
      this._checkAlarms(instance, instance.previousMetrics);
      this._pushHistory(instance);
      changed.push(instance.id);
    }, this);

    this.nodes.forEach(function (node) {
      if (node.status === "online") node.lastSync = now - Math.round(Math.random() * 900);
    });
    this.lastTick = now;
    this.emit("tick", { at: now, changed: changed });
  };

  Simulation.prototype.start = function () {
    var self = this;
    this.stop();
    if (!this.settings.autoRefresh) return;
    this.timer = global.setInterval(function () {
      self._tick(false);
    }, this.settings.intervalMs);
  };

  Simulation.prototype.stop = function () {
    if (this.timer) {
      global.clearInterval(this.timer);
      this.timer = null;
    }
  };

  Simulation.prototype.subscribe = function (listener) {
    this.listeners.push(listener);
    return function () {
      this.listeners = this.listeners.filter(function (item) { return item !== listener; });
    }.bind(this);
  };

  Simulation.prototype.emit = function (type, payload) {
    this.listeners.slice().forEach(function (listener) {
      try {
        listener(type, payload);
      } catch (error) {
        console.error("[console-data]", error);
      }
    });
  };

  Simulation.prototype._persist = function () {
    var thresholds = {};
    this.instances.forEach(function (instance) {
      thresholds[instance.id] = instance.thresholds;
    });
    var alarmState = {};
    this.alarms.forEach(function (alarm) {
      alarmState[alarm.id] = {
        status: alarm.status,
        read: alarm.read,
        acknowledgedAt: alarm.acknowledgedAt || null,
        acknowledgedBy: alarm.acknowledgedBy || null
      };
    });
    writeStore({
      settings: this.settings,
      defaultThresholds: this.defaultThresholds,
      thresholds: thresholds,
      alarmState: alarmState,
      savedAt: Date.now()
    });
  };

  Simulation.prototype.exportSnapshot = function () {
    return JSON.stringify({
      app: "变压器离线运维控制台",
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      offline: true,
      stats: this.getStats(),
      instances: this.instances.map(function (instance) {
        return {
          id: instance.id,
          name: instance.name,
          status: instance.status,
          health: instance.health,
          oilTemp: instance.metrics.oilTemp,
          load: instance.metrics.load,
          vibration: instance.metrics.vibration,
          partialDischarge: instance.metrics.partialDischarge,
          remainingLifeDays: instance.remainingLifeDays,
          thresholds: instance.thresholds,
          updatedAt: instance.lastUpdated
        };
      }),
      alarms: this.alarms,
      thresholds: this.defaultThresholds
    }, null, 2);
  };

  Simulation.prototype.resetDemoData = function () {
    this.stop();
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
    this.persisted = {};
    this.settings = {
      autoRefresh: true,
      intervalMs: 2000,
      sidebarCollapsed: false,
      activeTab: "overview"
    };
    this.defaultThresholds = Object.assign({}, DEFAULT_THRESHOLDS);
    this._buildFromSeeds();
    this._persist();
    this.emit("reset", null);
    this.start();
  };

  Cloud.data = new Simulation();
  Cloud.data.PROFILES = PROFILES;
  Cloud.data.DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS;
})(window);
