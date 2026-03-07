import { registry } from './module-registry';
import { MarketingModule } from '../modules/marketing.module';
import { PersonalModule } from '../modules/personal.module';
import { PersonalFinanceModule } from '../modules/personal-finance.module';
import { WebSearchModule } from '../modules/web-search.module';
import { CommunicationModule } from '../modules/communication.module';
import { SmartHomeModule } from '../modules/smart-home.module';
import { SchedulerModule } from '../modules/scheduler.module';
import { AutomationModule } from '../modules/automation.module';
import { MemoryModule } from '../modules/memory.module';
import { seedDefaultSchedules } from './scheduler-engine';
import { seedDefaultRules } from './rules-engine';
import prisma from '../../../config/database';

export function bootstrapEasyorios(): void {
  console.log('[Easyorios] Bootstrapping modules...');

  registry.register(new MarketingModule());
  registry.register(new PersonalModule());
  registry.register(new PersonalFinanceModule());
  registry.register(new WebSearchModule());
  registry.register(new CommunicationModule());
  registry.register(new SmartHomeModule());
  registry.register(new SchedulerModule());
  registry.register(new AutomationModule());
  registry.register(new MemoryModule());

  const modules = registry.getAllModules();
  console.log(`[Easyorios] ${modules.length} module(s) registered: ${modules.map(m => m.id).join(', ')}`);

  // Seed default schedules and rules for all users (fire-and-forget)
  seedDefaults().catch(e => console.error('[Easyorios] Seed defaults error:', e.message));
}

async function seedDefaults(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await seedDefaultSchedules(user.id);
    await seedDefaultRules(user.id);
  }
}
