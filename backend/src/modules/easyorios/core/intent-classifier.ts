import { askGemini } from '../../../agents/gemini';
import { registry } from './module-registry';
import { CommandResult } from './module.interface';

interface ClassifiedIntent {
  moduleId: string;
  commandName: string;
  confidence: number;
  extractedParams: Record<string, string>;
}

// Cache to avoid re-classifying identical messages
let intentCache: Map<string, ClassifiedIntent | null> = new Map();
const CACHE_MAX = 100;

function buildClassificationPrompt(message: string, availableModules: string[]): string {
  const moduleCommands = registry.getAllModules().map(m => {
    const cmds = m.getCommands().map(c => `  - ${c.name}: ${c.description}`).join('\n');
    return `[${m.id}] ${m.name}:\n${cmds}`;
  }).join('\n\n');

  return `Voce e um classificador de intencoes. Dada a mensagem do usuario, identifique qual modulo e comando mais se encaixa.

MODULOS DISPONIVEIS:
${moduleCommands}

MENSAGEM DO USUARIO: "${message}"

Responda APENAS em JSON valido (sem markdown, sem explicacao):
{"moduleId": "id_do_modulo", "commandName": "nome_do_comando", "confidence": 0.0-1.0, "extractedParams": {"param1": "valor1"}}

Se nenhum comando se encaixa, responda: {"moduleId": "none", "commandName": "none", "confidence": 0.0, "extractedParams": {}}`;
}

function parseClassification(response: string): ClassifiedIntent | null {
  try {
    // Extract JSON from response (might have markdown wrapping)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.moduleId || parsed.moduleId === 'none' || parsed.confidence < 0.5) return null;

    return {
      moduleId: parsed.moduleId,
      commandName: parsed.commandName,
      confidence: parsed.confidence,
      extractedParams: parsed.extractedParams || {},
    };
  } catch {
    return null;
  }
}

export async function classifyIntent(message: string): Promise<ClassifiedIntent | null> {
  // Check cache
  const cacheKey = message.toLowerCase().trim();
  if (intentCache.has(cacheKey)) return intentCache.get(cacheKey) || null;

  try {
    const modules = registry.getAllModules().map(m => m.id);
    const prompt = buildClassificationPrompt(message, modules);
    const response = await askGemini(prompt);
    const intent = parseClassification(response);

    // Cache result
    if (intentCache.size >= CACHE_MAX) {
      const firstKey = intentCache.keys().next().value;
      if (firstKey !== undefined) intentCache.delete(firstKey);
    }
    intentCache.set(cacheKey, intent);

    return intent;
  } catch (e: any) {
    console.error('[IntentClassifier] Error:', e.message);
    return null;
  }
}

export async function executeClassifiedIntent(
  message: string,
  userId: string,
  userRole?: string,
): Promise<CommandResult | null> {
  const intent = await classifyIntent(message);
  if (!intent) return null;

  console.log(`[IntentClassifier] Classified: ${intent.moduleId}.${intent.commandName} (${(intent.confidence * 100).toFixed(0)}%)`);

  const mod = registry.getModule(intent.moduleId);
  if (!mod) return null;

  // Find the matching command
  const commands = mod.getCommands();
  const cmd = commands.find(c => c.name === intent.commandName);
  if (!cmd) return null;

  // Role check
  const ROLE_HIERARCHY: Record<string, number> = { ADMIN: 3, MANAGER: 2, MEMBER: 1 };
  const requiredLevel = ROLE_HIERARCHY[cmd.requiredRole] || 1;
  const userLevel = ROLE_HIERARCHY[userRole || 'MEMBER'] || 1;
  if (userLevel < requiredLevel) {
    return { command: cmd.name, success: false, message: `Permissao insuficiente. Requer role ${cmd.requiredRole}.` };
  }

  // Build a synthetic match from extracted params
  // The command execute expects a RegExpMatchArray, so we create a minimal one
  const fakeMatch = [message] as RegExpMatchArray;
  fakeMatch.input = message;
  fakeMatch.index = 0;

  // Map extracted params to match groups
  const paramValues = Object.values(intent.extractedParams);
  paramValues.forEach((v, i) => { fakeMatch[i + 1] = v; });

  try {
    return await cmd.execute(fakeMatch, userId);
  } catch (e: any) {
    return { command: cmd.name, success: false, message: `Erro ao executar: ${e.message}` };
  }
}
