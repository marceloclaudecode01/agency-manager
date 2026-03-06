import { EasyoriosModule, CommandResult, ModuleContext, ModuleAlert, QuickAction } from './module.interface';

class ModuleRegistry {
  private modules: Map<string, EasyoriosModule> = new Map();

  register(mod: EasyoriosModule): void {
    this.modules.set(mod.id, mod);
    console.log(`[Easyorios] Module registered: ${mod.name} (${mod.id})`);
  }

  getModule(id: string): EasyoriosModule | undefined {
    return this.modules.get(id);
  }

  getAllModules(): EasyoriosModule[] {
    return Array.from(this.modules.values())
      .sort((a, b) => b.contextPriority - a.contextPriority);
  }

  async routeCommand(message: string, userId: string, userRole?: string): Promise<CommandResult | null> {
    for (const mod of this.getAllModules()) {
      const commands = mod.getCommands();
      for (const cmd of commands) {
        for (const pattern of cmd.patterns) {
          const match = message.match(pattern);
          if (match) {
            console.log(`[Registry] Matched: ${mod.id}.${cmd.name} (pattern: ${pattern}) role=${userRole}`);
            const ROLE_HIERARCHY: Record<string, number> = { ADMIN: 3, MANAGER: 2, MEMBER: 1 };
            const requiredLevel = ROLE_HIERARCHY[cmd.requiredRole] || 1;
            const userLevel = ROLE_HIERARCHY[userRole || 'MEMBER'] || 1;
            if (userLevel < requiredLevel) {
              console.log(`[Registry] Role blocked: need ${cmd.requiredRole} (${requiredLevel}), have ${userRole} (${userLevel})`);
              return {
                command: cmd.name,
                success: false,
                message: `Permissao insuficiente. Requer role ${cmd.requiredRole}.`,
              };
            }
            return cmd.execute(match, userId, userRole);
          }
        }
      }
    }
    return null;
  }

  async gatherAllContext(userId: string): Promise<ModuleContext[]> {
    const modules = this.getAllModules();
    const results = await Promise.allSettled(
      modules.map(m => m.gatherContext(userId))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ModuleContext> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async getAllAlerts(userId: string): Promise<ModuleAlert[]> {
    const modules = this.getAllModules();
    const results = await Promise.allSettled(
      modules.map(m => m.getProactiveAlerts(userId))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ModuleAlert[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  async getAllQuickActions(userId: string): Promise<QuickAction[]> {
    const modules = this.getAllModules();
    const results = await Promise.allSettled(
      modules.map(m => m.getQuickActions(userId))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<QuickAction[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }
}

export const registry = new ModuleRegistry();
