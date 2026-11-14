/*
 * 变压器离线运维控制台 · 原生 Canvas 折线图
 * 不依赖任何第三方图表库，支持多序列、阈值线、悬停提示与自适应尺寸。
 */
(function (global) {
  "use strict";

  var Cloud = (global.Cloud = global.Cloud || {});

  function LineChart(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrapper = canvas.parentElement;
    this.options = Object.assign({
      series: [],
      labels: [],
      yMin: null,
      yMax: null,
      decimals: 1,
      unit: "",
      thresholds: [],
      emptyText: "暂无数据"
    }, options || {});
    this.activeIndex = -1;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.tooltip = document.createElement("div");
    this.tooltip.className = "chart-tooltip";
    this.tooltip.hidden = true;
    this.wrapper.appendChild(this.tooltip);
    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this.resize = this.resize.bind(this);
    this.observer = null;

    this._bindEvents();
    this._observe();
    this.resize();
  }

  LineChart.prototype._bindEvents = function () {
    this.canvas.addEventListener("mousemove", this._onMove);
    this.canvas.addEventListener("mouseleave", this._onLeave);
  };

  LineChart.prototype._observe = function () {
    var self = this;
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(function () {
        self.resize();
      });
      this.observer.observe(this.wrapper);
    } else {
      global.addEventListener("resize", this.resize);
    }
  };

  LineChart.prototype.update = function (options) {
    var activeIndex = this.activeIndex;
    var tooltipVisible = !this.tooltip.hidden;
    this.options = Object.assign({}, this.options, options || {});
    var nextLength = (this.options.labels || []).length;
    this.activeIndex = activeIndex >= 0 && activeIndex < nextLength ? activeIndex : -1;
    this.render();
    if (this.activeIndex >= 0 && tooltipVisible) {
      this._showTooltip(this.activeIndex);
      if (this.lastMouseX !== undefined) this._positionTooltip(this.lastMouseX);
    } else {
      this.tooltip.hidden = true;
    }
  };

  LineChart.prototype.resize = function () {
    var rect = this.wrapper.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  };

  LineChart.prototype._bounds = function () {
    var options = this.options;
    var values = [];
    options.series.forEach(function (series) {
      (series.values || []).forEach(function (value) {
        if (Number.isFinite(Number(value))) values.push(Number(value));
      });
    });
    options.thresholds.forEach(function (threshold) {
      if (Number.isFinite(Number(threshold.value))) values.push(Number(threshold.value));
    });
    var min = options.yMin;
    var max = options.yMax;
    if (min === null || min === undefined) {
      min = Math.min.apply(null, values);
      min = Math.floor(min - Math.max(1, (Math.max.apply(null, values) - min) * 0.16));
      min = Math.max(0, min);
    }
    if (max === null || max === undefined) {
      max = Math.max.apply(null, values);
      max = Math.ceil(max + Math.max(1, (max - min) * 0.16));
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max) || max <= min) max = min + 10;
    return { min: min, max: max };
  };

  LineChart.prototype.render = function () {
    var ctx = this.ctx;
    var width = this.width;
    var height = this.height;
    if (!ctx || width < 10 || height < 10) return;

    var options = this.options;
    var labels = options.labels || [];
    var count = Math.max.apply(null, options.series.map(function (series) {
      return (series.values || []).length;
    }).concat([labels.length, 0]));

    ctx.clearRect(0, 0, width, height);
    if (!count || !options.series.length) {
      ctx.fillStyle = "#98a2b3";
      ctx.font = '12px "Microsoft YaHei UI", "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(options.emptyText, width / 2, height / 2);
      return;
    }

    var bounds = this._bounds();
    var min = bounds.min;
    var max = bounds.max;
    var pad = {
      left: 44,
      right: 12,
      top: 14,
      bottom: 26
    };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;

    var xAt = function (index) {
      if (count <= 1) return pad.left;
      return pad.left + (index / (count - 1)) * plotW;
    };
    var yAt = function (value) {
      return pad.top + plotH - ((Number(value) - min) / (max - min)) * plotH;
    };

    ctx.save();
    ctx.strokeStyle = "#eef1f5";
    ctx.lineWidth = 1;
    var yTicks = 4;
    ctx.font = '11px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    ctx.fillStyle = "#8f99a8";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (var i = 0; i <= yTicks; i += 1) {
      var value = min + ((max - min) / yTicks) * i;
      var y = Math.round(yAt(value)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(this._format(value), pad.left - 8, y);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    var xTicks = Math.min(6, labels.length);
    if (xTicks > 1) {
      for (var j = 0; j < xTicks; j += 1) {
        var idx = Math.round((labels.length - 1) * (j / (xTicks - 1)));
        var x = xAt(idx);
        ctx.textAlign = j === 0 ? "left" : j === xTicks - 1 ? "right" : "center";
        ctx.fillText(labels[idx] || "", x, height - pad.bottom + 8);
      }
    }
    ctx.textAlign = "center";
    ctx.restore();

    options.thresholds.forEach(function (threshold) {
      if (!Number.isFinite(Number(threshold.value))) return;
      var y = yAt(threshold.value);
      if (y < pad.top || y > height - pad.bottom) return;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = threshold.color || "#ff8f1f";
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1;
      ctx.moveTo(pad.left, Math.round(y) + 0.5);
      ctx.lineTo(width - pad.right, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.restore();
    });

    var self = this;
    options.series.forEach(function (series) {
      var values = series.values || [];
      if (!values.length) return;
      var color = series.color || "#2563eb";

      if (series.fill) {
        var gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
        gradient.addColorStop(0, self._hexToRgba(color, 0.16));
        gradient.addColorStop(1, self._hexToRgba(color, 0.01));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xAt(0), height - pad.bottom);
        for (var index = 0; index < values.length; index += 1) {
          ctx.lineTo(xAt(index), yAt(values[index]));
        }
        ctx.lineTo(xAt(values.length - 1), height - pad.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = series.width || 2;
      if (series.dashed) ctx.setLineDash([5, 4]);
      for (var point = 0; point < values.length; point += 1) {
        var px = xAt(point);
        var py = yAt(values[point]);
        if (point === 0) {
          ctx.moveTo(px, py);
        } else {
          var prevX = xAt(point - 1);
          var prevY = yAt(values[point - 1]);
          var midX = (prevX + px) / 2;
          ctx.bezierCurveTo(midX, prevY, midX, py, px, py);
        }
      }
      ctx.stroke();
      ctx.restore();
    });

    if (this.activeIndex >= 0 && this.activeIndex < count) {
      var activeX = xAt(this.activeIndex);
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(29, 33, 41, .19)";
      ctx.moveTo(activeX, pad.top);
      ctx.lineTo(activeX, height - pad.bottom);
      ctx.stroke();
      ctx.restore();

      options.series.forEach(function (series) {
        var value = (series.values || [])[self.activeIndex];
        if (!Number.isFinite(Number(value))) return;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = series.color || "#2563eb";
        ctx.lineWidth = 2;
        ctx.arc(activeX, yAt(value), 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }
  };

  LineChart.prototype._format = function (value) {
    var decimals = this.options.decimals === undefined ? 1 : this.options.decimals;
    return Number(value).toFixed(decimals);
  };

  LineChart.prototype._hexToRgba = function (hex, alpha) {
    if (!hex || hex.indexOf("#") !== 0) return "rgba(37, 99, 235, " + alpha + ")";
    var value = hex.slice(1);
    if (value.length === 3) {
      value = value.split("").map(function (char) { return char + char; }).join("");
    }
    var number = parseInt(value, 16);
    var r = (number >> 16) & 255;
    var g = (number >> 8) & 255;
    var b = number & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  };

  LineChart.prototype._onMove = function (event) {
    var labels = this.options.labels || [];
    if (!labels.length) return;
    var rect = this.canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    this.lastMouseX = x;
    var padLeft = 44;
    var padRight = 12;
    var plotW = rect.width - padLeft - padRight;
    var ratio = (x - padLeft) / plotW;
    var index = Math.round(ratio * (labels.length - 1));
    index = Math.max(0, Math.min(labels.length - 1, index));
    if (index === this.activeIndex) {
      this._positionTooltip(x);
      return;
    }
    this.activeIndex = index;
    this.render();
    this._showTooltip(index);
    this._positionTooltip(x);
  };

  LineChart.prototype._onLeave = function () {
    this.activeIndex = -1;
    this.tooltip.hidden = true;
    this.render();
  };

  LineChart.prototype._showTooltip = function (index) {
    var options = this.options;
    var title = (options.labels || [])[index] || "";
    var rows = options.series.map(function (series) {
      var value = (series.values || [])[index];
      if (!Number.isFinite(Number(value))) return "";
      return '<div class="chart-tooltip__row"><span><i style="background:' + (series.color || "#2563eb") + '"></i>' +
        (series.name || "") + "</span><b>" + Number(value).toFixed(options.decimals === undefined ? 1 : options.decimals) +
        " " + (options.unit || "") + "</b></div>";
    }).join("");
    this.tooltip.innerHTML = '<div class="chart-tooltip__time">' + (title || "") + "</div>" + rows;
    this.tooltip.hidden = false;
  };

  LineChart.prototype._positionTooltip = function (mouseX) {
    if (this.tooltip.hidden) return;
    var width = this.wrapper.clientWidth;
    var tooltipWidth = this.tooltip.offsetWidth || 128;
    var left = mouseX + 14;
    if (left + tooltipWidth > width) left = mouseX - tooltipWidth - 14;
    this.tooltip.style.left = Math.max(4, left) + "px";
    this.tooltip.style.top = "12px";
  };

  LineChart.prototype.destroy = function () {
    this.canvas.removeEventListener("mousemove", this._onMove);
    this.canvas.removeEventListener("mouseleave", this._onLeave);
    if (this.observer) this.observer.disconnect();
    else global.removeEventListener("resize", this.resize);
    if (this.tooltip && this.tooltip.parentElement) this.tooltip.parentElement.removeChild(this.tooltip);
  };

  function create(canvas, options) {
    if (!canvas) return null;
    return new LineChart(canvas, options);
  }

  Cloud.charts = {
    LineChart: LineChart,
    create: create
  };
})(window);
