import { registry } from './module-registry';
import { MarketingModule } from '../modules/marketing.module';
import { PersonalModule } from '../modules/personal.module';
import { PersonalFinanceModule } from '../modules/personal-finance.module';
import { WebSearchModule } from '../modules/web-search.module';
import { CommunicationModule } from '../modules/communication.module';

export function bootstrapEasyorios(): void {
  console.log('[Easyorios] Bootstrapping modules...');

  registry.register(new MarketingModule());
  registry.register(new PersonalModule());
  registry.register(new PersonalFinanceModule());
  registry.register(new WebSearchModule());
  registry.register(new CommunicationModule());

  const modules = registry.getAllModules();
  console.log(`[Easyorios] ${modules.length} module(s) registered: ${modules.map(m => m.id).join(', ')}`);
}
