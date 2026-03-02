'use client';

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface PerformanceChartsProps {
  metrics: any[];
  performance: any;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border/60 rounded-lg px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export function PerformanceCharts({ metrics, performance }: PerformanceChartsProps) {
  const chartData = [...(metrics || [])].reverse().slice(-7).map((m: any) => ({
    date: m.reportDate ? new Date(m.reportDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '',
    growth: m.growthScore || 0,
    engagement: m.engagement || 0,
    reach: m.reach || 0,
    posts: m.postsPublished || 0,
  }));

  const bestHours = performance?.bestHours || [];

  return (
    <div className="space-y-6">
      {/* Growth Score + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-heading font-semibold text-text-primary">Growth Score (7d)</h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 10]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="growth" name="Growth" stroke="#34d399" fill="url(#growthGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-text-secondary/50 text-center py-8">Sem dados</p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-heading font-semibold text-text-primary">Posts Publicados (7d)</h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="posts" name="Posts" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-text-secondary/50 text-center py-8">Sem dados</p>
          )}
        </div>
      </div>

      {/* Best Hours */}
      {bestHours.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
          <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">Melhores Horários de Engajamento</h3>
          <div className="flex gap-2 flex-wrap">
            {bestHours.map((h: any, i: number) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                {h.hour || h}:00 {h.score ? `(${h.score})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
