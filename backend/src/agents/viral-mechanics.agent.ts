import { askGemini } from './gemini';
import { getBrandContext } from './brand-brain.agent';
import { agentLog } from './agent-logger';

/**
 * Viral Mechanics Lab
 * Enhances content with viral triggers before publication.
 * Modules: Hook Generator, Emotional Amplifier, Curiosity Engine,
 *          Pattern Interrupt, Share Trigger Builder
 */

export interface ViralEnhancement {
  enhancedMessage: string;
  viralScore: number; // 1-10
  appliedTechniques: string[];
  hookType: string;
  emotionalTrigger: string;
}

// Viral techniques inspired by billion-dollar brand playbooks
// Sources: Nike emotional storytelling, Apple curiosity loops, Red Bull pattern interrupts,
//          Nubank community triggers, Netflix cliffhanger science
const VIRAL_TECHNIQUES = {
  hooks: [
    'DADO_IMPOSSIVEL',        // "97% das pessoas falham nisso — e a razao e contraintuitiva"
    'CONTRARIAN_FORTE',       // "Tudo que voce acredita sobre X esta cientificamente errado"
    'REVELACAO_INSIDER',      // "Trabalhei 10 anos com isso e so agora entendi que..."
    'PERGUNTA_IMPOSSIVEL',    // "Se voce pudesse mudar UMA coisa na sua vida agora, qual seria?"
    'HISTORIA_EM_MEDIA_RES',  // Comeca no climax — "Quando vi o resultado, nao acreditei"
    'AFIRMACAO_POLARIZANTE',  // "Disciplina e superestimada. O que funciona de verdade e..."
    'RUPTURA_COGNITIVA',      // "A pessoa mais produtiva que conheco trabalha 4h por dia"
  ],
  emotionalTriggers: [
    'CURIOSIDADE_IRRESISTIVEL',  // Loop aberto que o cerebro PRECISA fechar
    'FOMO_ESTRATEGICO',          // Medo de estar perdendo algo que todos ja sabem
    'ORGULHO_TRIBAL',            // "Quem entendeu isso, entendeu" — pertencimento exclusivo
    'SURPRESA_COGNITIVA',        // Dado que contradiz crenca popular — dopamina instantanea
    'IDENTIFICACAO_VISCERAL',    // Descrever situacao tao precisa que parece telepatia
    'ASPIRACAO_TANGIVEL',        // Futuro desejavel que parece alcancavel AGORA
    'INDIGNACAO_JUSTA',          // Algo que esta errado e precisa ser dito em voz alta
  ],
  shareMotivators: [
    'CAPITAL_SOCIAL',             // Compartilhar faz a pessoa parecer inteligente/atualizada
    'UTILIDADE_PURA',             // Tao util que guardar so pra si e egoismo
    'IDENTIDADE_TRIBAL',          // "Isso define quem eu sou" — compartilha como statement
    'MOEDA_DE_CONVERSA',          // Vira assunto de conversa no almoço/grupo de WhatsApp
    'VALIDACAO_EMOCIONAL',        // "Exatamente isso!" — valida o que a pessoa ja sente
  ],
  patternInterrupts: [
    'MICRO_CLIFFHANGER',          // Linha curta seguida de pausa — cria tensao
    'INVERSAO_NARRATIVA',         // Comeca com conclusao, depois revela o caminho
    'FRASE_DE_UMA_PALAVRA',       // Uma. Palavra. Sozinha. Cria impacto visual
    'CONTRASTE_DRAMATICO',        // Antes vs Depois, Mito vs Realidade, Expectativa vs Verdade
  ],
  commentTriggers: [
    'DEBATE_IMPOSSIVEL_DE_IGNORAR', // Opiniao forte que OBRIGA posicionamento
    'EXPERIENCIA_COMPARTILHADA',     // "Conta ai: quando foi a ultima vez que voce..."
    'ESCOLHA_IMPOSSIVEL',            // "Se tivesse que escolher entre A e B, qual seria?"
    'PREDICAO_PROVOCATIVA',          // "Daqui 5 anos isso vai ser obvio. Concorda?"
    'DESAFIO_PESSOAL',               // "Tenta fazer isso por 7 dias e volta pra me contar"
  ],
};

export async function enhanceWithViralMechanics(
  originalMessage: string,
  topic: string,
  contentCategory: string
): Promise<ViralEnhancement> {
  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const prompt = `Voce e o Chief Viral Officer de uma agencia que gerencia marcas bilionarias. Seu trabalho: transformar bom conteudo em conteudo IMPOSSIVEL DE IGNORAR.

Sua referencia: os times de conteudo da Nike, Apple, Nubank e Red Bull. Cada post que voce toca vira uma peca de comunicacao de classe mundial.

${brandCtx}

POST ORIGINAL:
"${originalMessage.substring(0, 500)}"

TEMA: ${topic}
CATEGORIA: ${contentCategory}

APLIQUE AS 5 CAMADAS DE VIRALIDADE (framework proprietario — TODAS obrigatorias):

CAMADA 1 — HOOK IMPOSSIVEL DE IGNORAR (escolha 1):
${VIRAL_TECHNIQUES.hooks.map(h => `- ${h}`).join('\n')}
Meta: A primeira linha deve ser tao forte que o cerebro do leitor PARA de rolar. Padrao: se nao funciona como titulo de materia do New York Times, reescreva.

CAMADA 2 — DETONADOR EMOCIONAL (escolha 1-2):
${VIRAL_TECHNIQUES.emotionalTriggers.map(e => `- ${e}`).join('\n')}
Meta: Ativar resposta emocional em menos de 2 segundos de leitura. Emocao precede logica — sempre.

CAMADA 3 — MOTOR DE COMPARTILHAMENTO (escolha 1-2):
${VIRAL_TECHNIQUES.shareMotivators.map(s => `- ${s}`).join('\n')}
Meta: O compartilhamento deve ser um ATO DE IDENTIDADE — a pessoa compartilha porque diz algo sobre QUEM ELA E.

CAMADA 4 — RUPTURA DE PADRAO (escolha 1):
${VIRAL_TECHNIQUES.patternInterrupts.map(p => `- ${p}`).join('\n')}
Meta: Quebrar a monotonia do feed com formatacao inesperada que forca o olho a parar.

CAMADA 5 — GATILHO DE COMENTARIO (escolha 1):
${VIRAL_TECHNIQUES.commentTriggers.map(c => `- ${c}`).join('\n')}
Meta: O comentario deve ser IRRESISTIVEL — nao "o que voce acha?" generico, mas algo que a pessoa PRECISA responder.

REGRAS DE OURO:
1. Mantenha a ESSENCIA e informacao — melhore a EXECUCAO, nao o conteudo
2. As 2 primeiras linhas decidem TUDO — invista 80% da criatividade ali
3. Gatilhos emocionais devem ser SUTIS — nivel Netflix, nao nivel spam
4. CTA final deve provocar, nao pedir — a diferenca entre "comenta ai" e uma pergunta que a pessoa PRECISA responder
5. Quebras de linha sao ARMAS — cada pausa cria tensao e facilita leitura mobile
6. Maximo 600 caracteres — brevidade e sofisticacao
7. PORTUGUES do Brasil, tom confiante e humano
8. ZERO clickbait barato — cada promessa deve ser cumprida no proprio post
9. Se o post original ja e forte, melhore SUTILMENTE — nao destrua o que funciona

Retorne APENAS JSON:
{
  "enhancedMessage": "texto melhorado aqui",
  "viralScore": 8,
  "appliedTechniques": ["HOOK_TIPO", "GATILHO_TIPO", "SHARE_TIPO", "PATTERN_TIPO", "COMMENT_TIPO"],
  "hookType": "DADO_IMPOSSIVEL",
  "emotionalTrigger": "CURIOSIDADE_IRRESISTIVEL",
  "commentTrigger": "DEBATE_IMPOSSIVEL_DE_IGNORAR"
}`;

  try {
    const raw = await askGemini(prompt);
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('Invalid viral enhancement response');

    const result = JSON.parse(match[0]);

    // Validate viralScore
    result.viralScore = Math.max(1, Math.min(10, result.viralScore || 5));

    await agentLog('Viral Mechanics', `Post "${topic}" enhanced: score ${result.viralScore}/10, techniques: ${result.appliedTechniques?.join(', ') || 'N/A'}`, {
      type: 'result',
      payload: { viralScore: result.viralScore, hookType: result.hookType },
    });

    return result;
  } catch (err: any) {
    await agentLog('Viral Mechanics', `Enhancement failed for "${topic}": ${err.message}`, { type: 'error' });
    // Return original with default score
    return {
      enhancedMessage: originalMessage,
      viralScore: 5,
      appliedTechniques: [],
      hookType: 'NONE',
      emotionalTrigger: 'NONE',
    };
  }
}

// Quick viral score check without enhancement (for Governor quality gate)
// Scoring calibrated to billion-dollar brand standards
export async function getViralScore(message: string): Promise<number> {
  try {
    const prompt = `Voce e o Quality Director de uma agencia bilionaria. Avalie o potencial viral deste post de 1 a 10.

CRITERIOS (padrao Nike/Apple/Nubank):
- Hook: A primeira linha para o scroll? (0-2 pontos)
- Emocao: Provoca resposta emocional em <2 segundos? (0-2 pontos)
- Valor: Entrega transformacao real, nao so informacao? (0-2 pontos)
- Compartilhabilidade: Alguem compartilharia como statement de identidade? (0-2 pontos)
- CTA: O fechamento provoca acao irresistivel? (0-2 pontos)

CALIBRACAO: 7+ = publicavel, 8+ = forte, 9+ = potencial viral real, 10 = raro — reservado para conteudo excepcional

Post: "${message.substring(0, 400)}"
Retorne APENAS o numero (1-10).`;

    const raw = await askGemini(prompt);
    const score = parseInt(raw.trim());
    return isNaN(score) ? 5 : Math.max(1, Math.min(10, score));
  } catch {
    return 5;
  }
}
