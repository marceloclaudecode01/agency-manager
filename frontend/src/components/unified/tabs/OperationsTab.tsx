'use client';

import { BrandPanel } from '@/components/command/BrandPanel';
import { OperationalControls } from '@/components/command/OperationalControls';
import { CampaignsPanel } from '@/components/command/CampaignsPanel';
import { CronSchedule } from '@/components/command/CronSchedule';
import { PerformanceCharts } from '@/components/command/PerformanceCharts';
import { TokenHealth } from '@/components/command/TokenHealth';

interface OperationsTabProps {
  brandConfig: any;
  strategy: any;
  campaigns: any[];
  metrics: any[];
  performance: any;
  tokenStatus: any;
  onSaveBrand: (d: any) => Promise<void>;
  onSaveStrategy: (d: any) => Promise<void>;
}

export function OperationsTab({ brandConfig, strategy, campaigns, metrics, performance, tokenStatus, onSaveBrand, onSaveStrategy }: OperationsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BrandPanel brand={brandConfig} onSave={onSaveBrand} />
        <OperationalControls strategy={strategy} onSaveStrategy={onSaveStrategy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">Campanhas de Conteúdo</h3>
          <CampaignsPanel campaigns={campaigns} />
        </div>
        <TokenHealth tokenStatus={tokenStatus} />
      </div>

      <CronSchedule />

      <PerformanceCharts metrics={metrics} performance={performance} />
    </div>
  );
}
