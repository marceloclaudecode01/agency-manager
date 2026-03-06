import { registry } from './module-registry';
import { MarketingModule } from '../modules/marketing.module';
import { PersonalModule } from '../modules/personal.module';

export function bootstrapEasyorios(): void {
  console.log('[Easyorios] Bootstrapping modules...');

  registry.register(new MarketingModule());
  registry.register(new PersonalModule());

  const modules = registry.getAllModules();
  console.log(`[Easyorios] ${modules.length} module(s) registered: ${modules.map(m => m.id).join(', ')}`);
}
