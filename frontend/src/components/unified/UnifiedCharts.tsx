'use client';

import { useMemo } from 'react';

interface Props {
  performance: any;
  engine: { todayPosts: any[] } | null;
}

export function UnifiedCharts({ performance, engine }: Props) {
  const chartData = useMemo(() => {
    if (!performance) return null;
    // performance may have .daily, .hourly, .insights etc.
    return performance;
  }, [performance]);

  // Simple bar chart using divs (no Recharts dependency required)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    const posts = engine?.todayPosts || [];
    posts.forEach((p: any) => {
      const h = new Date(p.scheduledFor).getHours();
      if (h >= 0 && h < 24) hours[h].count++;
    });
    return hours;
  }, [engine]);

  const maxCount = Math.max(1, ...hourlyData.map(h => h.count));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Posts Distribution */}
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">Posts by Hour (Today)</h3>
        <div className="flex items-end gap-1 h-32">
          {hourlyData.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full bg-primary/40 rounded-t transition-all hover:bg-primary/60"
                style={{ height: `${(h.count / maxCount) * 100}%`, minHeight: h.count > 0 ? '4px' : '0px' }}
                title={`${h.hour}:00 — ${h.count} posts`}
              />
              {h.hour % 4 === 0 && (
                <span className="text-[9px] text-text-secondary mt-1">{h.hour}h</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">Performance Insights</h3>
        {!chartData ? (
          <p className="text-xs text-text-secondary">No performance data available yet.</p>
        ) : (
          <div className="space-y-3 text-xs">
            {chartData.insights ? (
              <div className="space-y-2">
                {(Array.isArray(chartData.insights) ? chartData.insights : [chartData.insights]).slice(0, 5).map((insight: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 py-1 border-b border-border/20 last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
                    <span className="text-text-primary">{typeof insight === 'string' ? insight : insight.message || JSON.stringify(insight)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(chartData).slice(0, 6).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-border/20 last:border-0">
                    <span className="text-text-secondary capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-text-primary font-medium">{typeof val === 'number' ? val.toLocaleString() : String(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
