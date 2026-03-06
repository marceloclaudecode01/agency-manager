export interface CommandResult {
  command: string;
  success: boolean;
  message: string;
  data?: any;
}

export interface CommandDefinition {
  name: string;
  description: string;
  patterns: RegExp[];
  requiredRole: 'ADMIN' | 'MANAGER' | 'MEMBER';
  execute: (match: RegExpMatchArray, userId: string, userRole?: string) => Promise<CommandResult>;
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
  moduleId: string;
}

export interface ModuleAlert {
  id: string;
  moduleId: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: Date;
}

export interface ModuleContext {
  moduleId: string;
  summary: string;
  metrics: Record<string, any>;
}

export interface EasyoriosModule {
  id: string;
  name: string;
  icon: string;
  contextPriority: number;

  getCommands(): CommandDefinition[];
  gatherContext(userId: string): Promise<ModuleContext>;
  getQuickActions(userId: string): Promise<QuickAction[]>;
  getProactiveAlerts(userId: string): Promise<ModuleAlert[]>;
}
