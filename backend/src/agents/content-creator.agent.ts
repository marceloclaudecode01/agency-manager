import { askGemini } from './gemini';
import { getBrandContext } from './brand-brain.agent';

const PAGE_CONTEXT = `
Você é o agente de conteúdo de uma página de ALTO CRESCIMENTO no Facebook.
OBJETIVO: Criar conteúdo viral que gere compartilhamentos, comentários e salvamentos.

REGRAS ABSOLUTAS:
- NÃO produzir conteúdo sobre streamers, filmes, séries ou entretenimento genérico.
- Focar em: dicas práticas, insights poderosos, tendências, conhecimento útil, provocações inteligentes.
- Cada post DEVE entregar valor real ao leitor.
- Tom: inteligente, direto, humano, alternando entre educativo, inspirador e provocativo.
- Público: brasileiros que buscam crescimento, conhecimento e conteúdo que vale compartilhar.
- SEMPRE em português do Brasil.

FORMATOS DE ALTO ALCANCE (priorizar):
- Listas numeradas (ex: "5 coisas que...")
- Perguntas provocativas que geram debate
- Dicas práticas aplicáveis imediatamente
- Fatos surpreendentes / curiosidades
- Mini tutoriais em texto
- Conteúdo "salvável" (checklists, resumos)

GATILHOS DE ENGAJAMENTO (usar sempre):
- Perguntas abertas no final
- "Marca alguém que precisa ver isso"
- "Salva pra não esquecer"
- "Concorda ou discorda?"
- Pedir opinião / experiência pessoal
`;

export interface PostStructure {
  hook: string;       // Abertura que prende atenção em 3s
  contexto: string;   // Situação/problema que gera identificação
  valor: string;      // Entrega de valor real (dica, insight, dado)
  micro_prova: string; // Prova social, dado, exemplo, resultado
  cta: string;        // Chamada para ação que gera interação
}

export interface GeneratedPost {
  message: string;
  hashtags: string[];
  suggestedTime: string;
  topic: string;
  contentCategory: string;
  structure?: PostStructure;
}

export async function generatePost(topic: string, extraContext?: string): Promise<GeneratedPost> {
  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const prompt = `
${PAGE_CONTEXT}
${brandCtx}

Crie um post para o Facebook sobre o seguinte tema: "${topic}"
${extraContext ? `Contexto adicional: ${extraContext}` : ''}

Retorne APENAS um JSON válido neste formato exato:
{
  "message": "texto do post aqui (sem hashtags, máx 500 caracteres, use quebras de linha para legibilidade)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "suggestedTime": "HH:MM",
  "topic": "${topic}",
  "contentCategory": "educativo|engajamento|autoridade|bastidores"
}

Regras:
- A mensagem DEVE ser envolvente, original e entregar valor real
- Use quebras de linha (\\n) para formatar bem o texto
- SEMPRE termine com uma chamada para acao que gere interacao
- As hashtags devem ser populares e relevantes em portugues
- O horario sugerido deve ser entre 08:00 e 22:00
- Nao inclua as hashtags na mensagem
- NAO fale sobre filmes, series, streaming ou TV
- NAO use emojis — texto puro e direto, apenas caracteres ASCII
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid response from Gemini');
  return JSON.parse(jsonMatch[0]);
}

export async function generatePostFromStrategy(
  topic: string,
  focusType: string,
  recentTopics: string[],
  nicheOverride?: string,
  clientNotes?: string
): Promise<GeneratedPost> {
  const focusInstructions: Record<string, string> = {
    educativo: 'Ensine algo prático e aplicável. Dica, tutorial, checklist ou "como fazer". O leitor deve sair sabendo algo novo.',
    engajamento: 'Faça uma pergunta provocativa, crie debate, peça opinião. Objetivo: máximo de comentários e compartilhamentos.',
    autoridade: 'Mostre expertise com dados, análise inteligente, tendência ou estudo de caso. Posicione como referência.',
    bastidores: 'Humanize com bastidores, aprendizado pessoal, processo, desafio superado ou história real. Conexão emocional.',
    novidade: 'Apresente uma tendência quente, novidade útil ou fato surpreendente. Tom informativo mas empolgante.',
    cta: 'Crie conteúdo tão bom que o leitor queira compartilhar. Inclua "marca alguém" ou "salva pra depois".',
  };

  const focusGuide = focusInstructions[focusType] || focusInstructions['educativo'];
  const recentStr = recentTopics.length > 0 ? recentTopics.join(', ') : 'nenhum';

  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const nicheCtx = nicheOverride ? `
NICHO ESPECÍFICO: ${nicheOverride}
${clientNotes ? `INFORMAÇÕES REAIS DO NEGÓCIO (USE APENAS ESTAS — NUNCA INVENTE DADOS):
${clientNotes}` : ''}
IMPORTANTE: Todo o conteúdo DEVE ser 100% focado no nicho "${nicheOverride}".
REGRA CRÍTICA: Use SOMENTE informações reais fornecidas acima (planos, preços, benefícios, links). NUNCA invente valores, planos, preços ou benefícios que não existam.
Escreva como o MELHOR copywriter do mundo para este negócio.
Use terminologia, dores, desejos e linguagem específica deste nicho.
` : '';

  const prompt = `
${PAGE_CONTEXT}
${brandCtx}
${nicheCtx}

INSTRUÇÃO DE FORMATO: Varie SEMPRE o formato. Alterne entre:
- Lista numerada
- Pergunta provocativa
- Dica prática direta
- Fato surpreendente + análise
- Mini tutorial passo a passo
- Opinião controversa (polêmica leve e inteligente)

Crie um post para o Facebook sobre o tema: "${topic}"
Tipo de foco: ${focusType} — ${focusGuide}

ANTI-REPETIÇÃO (CRÍTICO): O tema DEVE ser COMPLETAMENTE DIFERENTE dos recentes abaixo. Não repita tema, ângulo, abordagem ou variação semelhante. Se o tema for parecido com qualquer um dos listados, escolha outro completamente novo.
Temas recentes (últimos 50 posts — PROIBIDO repetir): ${recentStr}
PROIBIDO: Falar sobre filmes, séries, streaming, TV, streamers.
O post DEVE estar alinhado a um dos 4 pilares temáticos definidos nas brand guidelines.

ESTRUTURA OBRIGATÓRIA DO POST (5 passos — TODOS obrigatórios):
1. HOOK: Abertura que prende atenção em 3 segundos (pergunta chocante, número impactante, contrarian)
2. CONTEXTO: Situação ou problema que gera identificação imediata no leitor
3. VALOR: Entrega de valor real — dica prática, insight, dado concreto
4. MICRO_PROVA: Prova social, dado estatístico, exemplo real ou resultado concreto
5. CTA: Chamada para ação que gera interação (pergunta aberta, marca alguém, salva)

O "message" DEVE conter os 5 blocos em sequência, separados por quebras de linha.

Retorne APENAS um JSON válido neste formato exato:
{
  "message": "texto do post aqui (sem hashtags, máx 600 caracteres, use \\n para quebras de linha)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "suggestedTime": "HH:MM",
  "topic": "${topic}",
  "contentCategory": "${focusType}",
  "structure": {
    "hook": "frase de abertura isolada",
    "contexto": "contexto/problema",
    "valor": "dica/insight/dado",
    "micro_prova": "prova social/exemplo/resultado",
    "cta": "chamada para ação"
  }
}

Regras:
- A mensagem DEVE seguir os 5 passos da estrutura acima — TODOS obrigatórios
- Use formatacao com quebras de linha para facilitar leitura
- SEMPRE inclua CTA que estimule interacao (pergunta, marca alguem, salva)
- As hashtags devem ser populares em portugues
- Horario sugerido entre 08:00 e 22:00
- Nao inclua as hashtags na mensagem
- NAO use emojis — texto puro e direto, apenas caracteres ASCII
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid response from Gemini');
  return JSON.parse(jsonMatch[0]);
}

export async function generateWeeklyPlan(focus: string): Promise<GeneratedPost[]> {
  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const prompt = `
${PAGE_CONTEXT}
${brandCtx}

Crie um plano de 7 posts para a semana com foco geral em: "${focus}"

DISTRIBUIÇÃO OBRIGATÓRIA na semana:
- 3 posts educativos (dicas, tutoriais, checklists)
- 2 posts de engajamento (perguntas, debates, enquetes)
- 1 post de autoridade (dados, análise, tendência)
- 1 post de bastidores (humanização, história, processo)

Cada dia DEVE ter ângulo, formato e tom DIFERENTES.

Retorne APENAS um JSON válido neste formato:
[
  {
    "message": "texto do post (use \\n para quebras de linha)",
    "hashtags": ["tag1", "tag2", "tag3"],
    "suggestedTime": "19:00",
    "topic": "tema específico do dia",
    "contentCategory": "educativo|engajamento|autoridade|bastidores"
  }
]

Gere exatamente 7 objetos no array, um para cada dia.
Varie os horários entre 08:00 e 22:00.
NÃO fale sobre filmes, séries, streaming ou TV.
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid response from Gemini');
  return JSON.parse(jsonMatch[0]);
}
