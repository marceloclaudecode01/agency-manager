'use client';

import { Clock, CheckCircle } from 'lucide-react';

const CRON_JOBS = [
  { name: 'Motor Autônomo', schedule: '07:00', desc: 'Gera posts do dia' },
  { name: 'Métricas', schedule: '08:00', desc: 'Analisa engajamento' },
  { name: 'Token Monitor', schedule: '09:00', desc: 'Verifica token FB' },
  { name: 'Produtos (1)', schedule: '10:00', desc: 'Posts produtos' },
  { name: 'Produtos (2)', schedule: '15:00', desc: 'Posts produtos' },
  { name: 'Vídeo Motivacional', schedule: '06/12/18h', desc: 'Gera vídeos' },
  { name: 'Tendências', schedule: 'Seg 06:00', desc: 'Temas em alta' },
  { name: 'Scheduler', schedule: '*/5min', desc: 'Publica agendados' },
  { name: 'Comentários', schedule: '*/30min', desc: 'Responde comments' },
  { name: 'Content Governor', schedule: '*/10min', desc: 'Aprova/rejeita posts' },
  { name: 'Growth Director', schedule: 'Dom 22:00', desc: 'Ajusta estratégia' },
  { name: 'Sentinel', schedule: '*/5min', desc: 'Monitora saúde' },
  { name: 'Perf Learner', schedule: '23:00', desc: 'Aprende padrões' },
];

export function CronSchedule() {
  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-heading font-semibold text-text-primary">Cron Schedule</h3>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {CRON_JOBS.map((job, i) => {
          const hourMatch = job.schedule.match(/^(\d{2}):/);
          const isPast = hourMatch ? parseInt(hourMatch[1]) <= currentHour : false;
          return (
            <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-hover/50 transition-colors text-xs">
              {isPast ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-text-secondary/40 flex-shrink-0" />
              )}
              <span className="font-mono text-text-secondary w-16 flex-shrink-0">{job.schedule}</span>
              <span className="text-text-primary font-medium flex-1">{job.name}</span>
              <span className="text-text-secondary/60">{job.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
