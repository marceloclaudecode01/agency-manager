import { EasyoriosModule } from './module.interface';
import { registry } from './module-registry';

interface PluginConfig {
  id: string;
  name: string;
  enabled: boolean;
  modulePath?: string; // relative to plugins dir
  config?: Record<string, any>;
}

interface PluginManifest {
  version: string;
  plugins: PluginConfig[];
}

// In-memory plugin registry (could be backed by DB or config file)
const pluginConfigs: Map<string, PluginConfig> = new Map();

export function registerPlugin(mod: EasyoriosModule, config?: Partial<PluginConfig>): void {
  const pluginConfig: PluginConfig = {
    id: mod.id,
    name: mod.name,
    enabled: true,
    ...config,
  };

  pluginConfigs.set(mod.id, pluginConfig);
  registry.register(mod);
  console.log(`[Easyorios Plugin] Registered: ${mod.name} (${mod.id})`);
}

export function unregisterPlugin(moduleId: string): boolean {
  const config = pluginConfigs.get(moduleId);
  if (!config) return false;

  config.enabled = false;
  pluginConfigs.set(moduleId, config);
  console.log(`[Easyorios Plugin] Disabled: ${moduleId}`);
  return true;
}

export function enablePlugin(moduleId: string): boolean {
  const config = pluginConfigs.get(moduleId);
  if (!config) return false;

  config.enabled = true;
  pluginConfigs.set(moduleId, config);
  console.log(`[Easyorios Plugin] Enabled: ${moduleId}`);
  return true;
}

export function getPluginStatus(): PluginConfig[] {
  return Array.from(pluginConfigs.values());
}

export function getManifest(): PluginManifest {
  return {
    version: '1.0.0',
    plugins: Array.from(pluginConfigs.values()),
  };
}

/**
 * Create a module from a simple config object (for users who don't want to write full classes).
 * Useful for lightweight custom plugins.
 */
export function createSimpleModule(config: {
  id: string;
  name: string;
  icon: string;
  commands: Array<{
    name: string;
    description: string;
    pattern: string; // regex string
    handler: (match: RegExpMatchArray, userId: string) => Promise<{ success: boolean; message: string; data?: any }>;
  }>;
}): EasyoriosModule {
  return {
    id: config.id,
    name: config.name,
    icon: config.icon,
    contextPriority: 1,

    getCommands() {
      return config.commands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        patterns: [new RegExp(cmd.pattern, 'i')],
        requiredRole: 'MEMBER' as const,
        execute: async (match: RegExpMatchArray, userId: string) => {
          const result = await cmd.handler(match, userId);
          return { command: cmd.name, ...result };
        },
      }));
    },

    async gatherContext() {
      return { moduleId: config.id, summary: `Plugin ${config.name} ativo`, metrics: {} };
    },

    async getQuickActions() {
      return [];
    },

    async getProactiveAlerts() {
      return [];
    },
  };
}
