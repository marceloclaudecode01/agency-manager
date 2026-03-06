import { askGemini } from '../../agents/gemini';
import { registry } from './core/module-registry';
import { CommandResult, ModuleContext } from './core/module.interface';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Context cache
let cachedContexts: ModuleContext[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 60_000;

async function gatherModuleContexts(userId: string): Promise<ModuleContext[]> {
  const now = Date.now();
  if (cachedContexts && now - cacheTs < CACHE_TTL) return cachedContexts;
  cachedContexts = await registry.gatherAllContext(userId);
  cacheTs = now;
  return cachedContexts;
}

function buildSystemPrompt(contexts: ModuleContext[], moduleNames: string[]): string {
  const contextBlock = contexts
    .map(c => `[${c.moduleId.toUpperCase()}] ${c.summary}`)
    .join('\n');

  const commandList = registry.getAllModules()
    .flatMap(m => m.getCommands())
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  return `Voce e o **Easyorios**, um assistente pessoal universal inteligente. Voce tem acesso a multiplos modulos:

MODULOS ATIVOS: ${moduleNames.join(', ')}

DADOS EM TEMPO REAL:
${contextBlock}

COMANDOS DISPONIVEIS:
${commandList}

Personalidade:
- Assistente pessoal proativo e inteligente
- Usa dados reais para embasar respostas
- Direto, objetivo, responde em portugues brasileiro
- Quando o usuario pede uma acao, EXECUTE via comando — nao pergunte se ele quer executar
- Pode combinar informacoes de todos os modulos para dar respostas completas

Regras:
- Sempre responda em portugues brasileiro
- Use os dados reais — nunca invente numeros
- Recomende acoes baseadas nos dados disponiveis
- Quando o usuario pede para publicar/agendar/lembrar/anotar, EXECUTE diretamente`;
}

export async function getEasyoriosResponse(
  userMessage: string,
  history: ChatMessage[],
  userId: string,
  userRole?: string,
): Promise<{ response: string; commandResult?: CommandResult }> {
  // Try command execution first
  let commandResult: CommandResult | null = null;
  try {
    commandResult = await registry.routeCommand(userMessage, userId, userRole);
  } catch (e: any) {
    console.error('[Easyorios] Command error:', e.message);
  }

  // Gather contexts from all modules
  const contexts = await gatherModuleContexts(userId);
  const moduleNames = registry.getAllModules().map(m => m.name);

  let response: string;
  try {
    const systemPrompt = buildSystemPrompt(contexts, moduleNames);

    const conversationContext = history
      .slice(-10)
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Easyorios'}: ${msg.content}`)
      .join('\n');

    const commandContext = commandResult
      ? `\n\n[COMANDO EXECUTADO]: ${commandResult.command} — ${commandResult.success ? 'SUCESSO' : 'FALHA'}: ${commandResult.message}${commandResult.data ? `\nDados: ${JSON.stringify(commandResult.data)}` : ''}\nNarre o resultado ao usuario de forma natural.`
      : '';

    const prompt = `${systemPrompt}
${conversationContext ? `\nHistorico recente:\n${conversationContext}\n` : ''}
Usuario: ${userMessage}${commandContext}

Easyorios:`;

    response = await askGemini(prompt);
    if (!response) throw new Error('Empty response');
  } catch (e: any) {
    console.error('[Easyorios] LLM error:', e.message);
    if (commandResult) {
      response = commandResult.success
        ? `Comando executado: ${commandResult.message}`
        : `Falha no comando: ${commandResult.message}`;
    } else {
      const ctx = contexts.map(c => `${c.moduleId}: ${c.summary}`).join(' | ');
      response = `Dados atuais: ${ctx || 'sem dados'}. A IA esta temporariamente indisponivel.`;
    }
  }

  return { response, commandResult: commandResult || undefined };
}

export async function getModulesInfo() {
  return registry.getAllModules().map(m => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    commandCount: m.getCommands().length,
  }));
}
