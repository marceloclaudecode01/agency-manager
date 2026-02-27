const { MetricsCollector } = require('./metrics-collector');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSeedData(options = {}) {
  const days = Number(options.days || 30);
  const runsPerDay = Number(options.runsPerDay || 8);
  const weekendReduction = options.weekendReduction !== false;

  const collector = new MetricsCollector();
  const metrics = {
    lastUpdated: new Date().toISOString(),
    retentionDays: 30,
    layers: {
      layer1: { passRate: 0, avgTimeMs: 0, totalRuns: 0, lastRun: null },
      layer2: {
        passRate: 0,
        avgTimeMs: 0,
        totalRuns: 0,
        lastRun: null,
        autoCatchRate: 0,
        coderabbit: {
          active: true,
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

  const now = new Date();
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);

    const dow = day.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const dayRuns = weekendReduction && isWeekend
      ? Math.max(1, Math.floor(runsPerDay / 2))
      : runsPerDay;

    for (let i = 0; i < dayRuns; i++) {
      const layer = (i % 3) + 1;
      const passed = Math.random() < (layer === 2 ? 0.8 : 0.9);
      const timestamp = new Date(day);
      timestamp.setHours(randomInt(8, 22), randomInt(0, 59), randomInt(0, 59), 0);

      metrics.history.push({
        timestamp: timestamp.toISOString(),
        layer,
        passed,
        durationMs: randomInt(800, 12000),
        findingsCount: passed ? randomInt(0, 2) : randomInt(2, 8),
      });
    }
  }

  metrics.history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Reuse collector logic by writing then reading recomputed metrics via record-like approach.
  // Fast path: set and ask collector to cleanup+export recompute through private-free flow.
  const storePath = collector.storePath;
  require('fs').mkdirSync(require('path').dirname(storePath), { recursive: true });
  require('fs').writeFileSync(storePath, JSON.stringify(metrics, null, 2), 'utf8');

  // Trigger recompute using cleanup (which preserves all recent seeded rows)
  collector.cleanup();

  const seeded = require('fs').readFileSync(storePath, 'utf8');
  return JSON.parse(seeded);
}

async function seedMetrics(options = {}) {
  return generateSeedData(options);
}

module.exports = { seedMetrics, generateSeedData };
