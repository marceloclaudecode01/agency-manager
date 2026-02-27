const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function defaultMetrics(retentionDays = 30) {
  return {
    lastUpdated: null,
    retentionDays,
    layers: {
      layer1: { passRate: 0, avgTimeMs: 0, totalRuns: 0, lastRun: null },
      layer2: {
        passRate: 0,
        avgTimeMs: 0,
        totalRuns: 0,
        lastRun: null,
        autoCatchRate: 0,
        coderabbit: {
          active: false,
          findingsCount: 0,
          severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        },
        quinn: { findingsCount: 0, topCategories: [] },
      },
      layer3: { passRate: 0, avgTimeMs: 0, totalRuns: 0, lastRun: null },
    },
    history: [],
    trends: { passRates: [], autoCatchRate: [] },
  };
}

class MetricsCollector {
  constructor(options = {}) {
    this.retentionDays = Number(options.retentionDays || 30);
    this.storePath = path.join(process.cwd(), '.aios', 'data', 'quality-metrics.json');
    ensureDir(path.dirname(this.storePath));
  }

  async getMetrics() {
    const loaded = this._load();
    if (typeof loaded.retentionDays !== 'number') loaded.retentionDays = this.retentionDays;
    return loaded;
  }

  async recordRun(layer, result = {}) {
    const metrics = this._load();
    const run = {
      timestamp: new Date().toISOString(),
      layer,
      passed: !!result.passed,
      durationMs: Number(result.durationMs || 0),
      findingsCount: Number(result.findingsCount || 0),
      metadata: result.metadata || {},
      coderabbit: result.coderabbit,
      quinn: result.quinn,
    };

    metrics.history.push(run);

    if (layer === 2 && result.coderabbit) {
      metrics.layers.layer2.coderabbit = {
        active: true,
        findingsCount: Number(result.coderabbit.findingsCount || 0),
        severityBreakdown: {
          critical: Number(result.coderabbit.severityBreakdown?.critical || 0),
          high: Number(result.coderabbit.severityBreakdown?.high || 0),
          medium: Number(result.coderabbit.severityBreakdown?.medium || 0),
          low: Number(result.coderabbit.severityBreakdown?.low || 0),
        },
      };
    }

    if (layer === 2 && result.quinn) {
      metrics.layers.layer2.quinn = {
        findingsCount: Number(result.quinn.findingsCount || 0),
        topCategories: Array.isArray(result.quinn.topCategories) ? result.quinn.topCategories : [],
      };
    }

    this._cleanupHistory(metrics);
    this._recompute(metrics);
    this._save(metrics);
    return run;
  }

  async recordPRReview(result = {}) {
    return this.recordRun(2, result);
  }

  async cleanup() {
    const metrics = this._load();
    const before = metrics.history.length;
    this._cleanupHistory(metrics);
    const removed = before - metrics.history.length;
    this._recompute(metrics);
    this._save(metrics);
    return removed;
  }

  async export(format = 'json') {
    const metrics = this._load();
    if (format === 'csv') {
      const header = 'timestamp,layer,passed,durationMs,findingsCount';
      const rows = metrics.history.map((r) => [
        r.timestamp,
        r.layer,
        r.passed ? 'true' : 'false',
        Number(r.durationMs || 0),
        Number(r.findingsCount || 0),
      ].join(','));
      return [header, ...rows].join('\n');
    }
    return JSON.stringify(metrics, null, 2);
  }

  _cleanupHistory(metrics) {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    metrics.history = metrics.history.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return Number.isFinite(t) && t > cutoff;
    });
  }

  _recompute(metrics) {
    metrics.lastUpdated = new Date().toISOString();
    metrics.retentionDays = this.retentionDays;

    const byLayer = { 1: [], 2: [], 3: [] };
    for (const r of metrics.history) {
      if (byLayer[r.layer]) byLayer[r.layer].push(r);
    }

    const layerKeys = { 1: 'layer1', 2: 'layer2', 3: 'layer3' };
    for (const layerNum of [1, 2, 3]) {
      const runs = byLayer[layerNum];
      const key = layerKeys[layerNum];
      const totalRuns = runs.length;
      const passedRuns = runs.filter((r) => r.passed).length;
      const avgTimeMs = totalRuns > 0
        ? Math.round(runs.reduce((acc, r) => acc + Number(r.durationMs || 0), 0) / totalRuns)
        : 0;
      const lastRun = totalRuns > 0 ? runs[runs.length - 1].timestamp : null;

      metrics.layers[key] = {
        ...metrics.layers[key],
        passRate: totalRuns > 0 ? passedRuns / totalRuns : 0,
        avgTimeMs,
        totalRuns,
        lastRun,
      };
    }

    const layer2 = byLayer[2];
    if (layer2.length > 0) {
      const findings = layer2.reduce((acc, r) => acc + Number(r.findingsCount || 0), 0);
      const bounded = Math.max(0, Math.min(1, 1 - findings / (layer2.length * 10 || 1)));
      metrics.layers.layer2.autoCatchRate = bounded;
    } else {
      metrics.layers.layer2.autoCatchRate = 0;
    }

    const groupedPass = new Map();
    for (const r of metrics.history) {
      const d = String(r.timestamp || '').slice(0, 10);
      if (!groupedPass.has(d)) groupedPass.set(d, []);
      groupedPass.get(d).push(r.passed ? 1 : 0);
    }
    metrics.trends.passRates = Array.from(groupedPass.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, vals]) => ({ date, value: vals.reduce((a, b) => a + b, 0) / vals.length }));

    metrics.trends.autoCatchRate = metrics.trends.passRates.map((p) => ({
      date: p.date,
      value: metrics.layers.layer2.autoCatchRate || 0,
    }));
  }

  _load() {
    if (!fs.existsSync(this.storePath)) {
      const m = defaultMetrics(this.retentionDays);
      this._save(m);
      return m;
    }

    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...defaultMetrics(this.retentionDays),
        ...parsed,
        layers: {
          ...defaultMetrics(this.retentionDays).layers,
          ...(parsed.layers || {}),
          layer2: {
            ...defaultMetrics(this.retentionDays).layers.layer2,
            ...((parsed.layers || {}).layer2 || {}),
          },
        },
      };
    } catch (_error) {
      const m = defaultMetrics(this.retentionDays);
      this._save(m);
      return m;
    }
  }

  _save(metrics) {
    ensureDir(path.dirname(this.storePath));
    fs.writeFileSync(this.storePath, JSON.stringify(metrics, null, 2), 'utf8');
  }
}

module.exports = { MetricsCollector };
