import { askGemini } from '../../agents/gemini';
import { registry } from './core/module-registry';
import { CommandResult, ModuleContext } from './core/module.interface';
import { executeClassifiedIntent } from './core/intent-classifier';
import { matchTaskTemplate, executeFullTask } from './core/task-engine';

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

  return `Voce e o **Easyorios**, assistente inteligente de uma AGENCIA DE MARKETING DIGITAL. Voce gerencia a agencia inteira — posts, agentes autonomos, clientes, campanhas, leads, metricas — e tambem funciona como assistente pessoal do dono.

CONTEXTO DA AGENCIA:
- Sistema com ${moduleNames.length} modulos integrados
- Modulo de MARKETING: gerencia agentes autonomos que criam, agendam e publicam posts automaticamente no Facebook/Instagram para multiplos clientes
- Agentes incluem: content-creator, scheduler, comment-responder, viral-mechanics, performance-learner, growth-analyst, metrics-analyzer, sentinel, governor, e mais
- Publicacoes sao automaticas via Facebook Graph API
- O sistema roda 24/7 autonomamente

MODULOS ATIVOS: ${moduleNames.join(', ')}

DADOS EM TEMPO REAL:
${contextBlock}

COMANDOS DISPONIVEIS:
${commandList}

TAREFAS MULTI-ETAPA DISPONIVEIS:
- "planeja minha semana" — briefing + financas + lembretes + to-dos + marketing
- "rotina da manha" — briefing + lembretes + status casa + noticias
- "revisao financeira" — resumo financeiro + transacoes + briefing
- "rotina da noite" — to-dos + financas + posts pendentes

Personalidade:
- Voce CONHECE a agencia — quando perguntarem sobre a agencia, responda com os dados reais do modulo MARKETING
- Assistente proativo e inteligente que domina marketing digital
- Usa dados reais para embasar respostas
- Direto, objetivo, responde em portugues brasileiro
- Quando o usuario pede uma acao, EXECUTE via comando — nao pergunte se ele quer executar
- Pode combinar informacoes de todos os modulos para dar respostas completas
- Quando perguntarem "o que voce faz" ou "suas capacidades", liste TODOS os modulos e o que cada um faz

Regras:
- Sempre responda em portugues brasileiro
- Use os dados reais — nunca invente numeros
- Recomende acoes baseadas nos dados disponiveis
- Quando o usuario pede para publicar/agendar/lembrar/anotar, EXECUTE diretamente
- NUNCA diga que nao conhece a agencia — voce E o cerebro dela`;
}

export async function getEasyoriosResponse(
  userMessage: string,
  history: ChatMessage[],
  userId: string,
  userRole?: string,
): Promise<{ response: string; commandResult?: CommandResult }> {
  // 1. Check multi-turn task templates first
  const taskTemplate = matchTaskTemplate(userMessage);
  if (taskTemplate) {
    try {
      const taskResult = await executeFullTask(userId, taskTemplate, userRole);
      return { response: taskResult.message, commandResult: taskResult };
    } catch (e: any) {
      console.error('[Easyorios] Task engine error:', e.message);
    }
  }

  // 2. Try regex command matching (fast path)
  let commandResult: CommandResult | null = null;
  try {
    commandResult = await registry.routeCommand(userMessage, userId, userRole);
    if (commandResult) {
      console.log(`[Easyorios] Regex match: ${commandResult.command} (success=${commandResult.success})`);
    }
  } catch (e: any) {
    console.error('[Easyorios] Command error:', e.message);
  }

  // 3. If no regex match, try LLM intent classification (slow path)
  if (!commandResult) {
    console.log(`[Easyorios] No regex match for: "${userMessage.slice(0, 60)}" — trying intent classifier`);
    try {
      commandResult = await executeClassifiedIntent(userMessage, userId, userRole);
      if (commandResult) {
        console.log(`[Easyorios] Intent classified: ${commandResult.command} (success=${commandResult.success})`);
      }
    } catch (e: any) {
      console.error('[Easyorios] Intent classifier error:', e.message);
    }
  }

  // 4. Gather contexts from all modules
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
