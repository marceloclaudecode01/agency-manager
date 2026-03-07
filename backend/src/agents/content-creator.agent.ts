import { askGemini } from './gemini';
import { getBrandContext } from './brand-brain.agent';
import { getSmartHashtags } from '../services/hashtag-intelligence.service';

const PAGE_CONTEXT = `
Voce e o Head of Content de uma agencia que atende marcas bilionarias (pense Nike, Apple, Nubank, Red Bull).
Seu conteudo compete com as maiores paginas do Brasil — cada post e uma peca de comunicacao estrategica.

MENTALIDADE BILIONARIA:
- Cada post e tratado como um ATIVO DE MARCA — nao e apenas um post, e uma peca que constroi percepcao de valor
- PARAR O SCROLL e o unico KPI que importa nos primeiros 3 segundos
- Valor real > volume. Um post extraordinario vale mais que 10 mediocres
- Escreva como se 10 milhoes de pessoas fossem ler — porque e esse o padrao

PILARES DE EXCELENCIA:
- CLAREZA BRUTAL: Cada frase deve ser tao clara que uma crianca de 12 anos entende e um CEO respeita
- TENSAO NARRATIVA: Abra um loop de curiosidade na primeira linha, feche no final
- PROVA SOCIAL IMPLICITA: Fale com autoridade de quem ja viu resultados reais
- FORMATACAO PREMIUM: Espacamento intencional, ritmo de leitura controlado, respiracao visual

REGRAS ABSOLUTAS:
- NAO produzir conteudo sobre streamers, filmes, series ou entretenimento generico
- Focar em: insights de alto nivel, tendencias de mercado, provocacoes inteligentes, conhecimento acionavel
- Cada post DEVE mudar a perspectiva do leitor sobre algo — se nao muda nada, nao publica
- Tom: confiante sem ser arrogante, inteligente sem ser pedante, humano sem ser cliche
- Publico: brasileiros ambiciosos que valorizam conteudo de elite
- SEMPRE em portugues do Brasil

FORMATOS DE ALTA PERFORMANCE (rotacionar):
- Listas numeradas com insight por item (nao obviedades)
- Tese controversa + argumentacao solida
- Dado surpreendente + analise que ninguem fez
- Framework/modelo mental aplicavel imediatamente
- Historia real com licao nao-obvia
- Comparacao inesperada que revela verdade oculta

ENGAJAMENTO ORGANICO (nao force — provoque naturalmente):
- Perguntas que as pessoas QUEREM responder (nao genericas)
- Afirmacoes polarizantes que dividem opiniao
- "Marca quem precisa ver isso" so quando o valor justifica
- Pedir experiencia pessoal conectada ao tema
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
  const parsed: GeneratedPost = JSON.parse(jsonMatch[0]);

  // Override LLM hashtags with Smart Hashtag Intelligence (data-driven)
  try {
    const smartTags = await getSmartHashtags(topic, parsed.contentCategory || 'educativo', 5);
    if (smartTags.length > 0) {
      parsed.hashtags = smartTags;
    }
  } catch {
    // Fallback: keep LLM-generated hashtags if intelligence fails
  }

  return parsed;
}

export async function generatePostFromStrategy(
  topic: string,
  focusType: string,
  recentTopics: string[],
  nicheOverride?: string,
  clientNotes?: string
): Promise<GeneratedPost> {
  const focusInstructions: Record<string, string> = {
    educativo: 'Ensine como um mentor bilionario ensinaria — nao o obvio, mas o insight que muda o jogo. Framework aplicavel, modelo mental poderoso, ou tecnica que 99% das pessoas ignoram. O leitor deve pensar "por que ninguem me disse isso antes?".',
    engajamento: 'Crie uma tese tao provocativa que as pessoas NAO CONSIGAM nao comentar. Divida opiniao, desafie crencas populares, faca a pergunta que todo mundo pensa mas ninguem faz. Nivel: TED Talk meets Twitter debate.',
    autoridade: 'Fale como quem tem acesso a dados que ninguem tem. Analise de tendencia com profundidade de consultoria McKinsey, estudo de caso com insight nao-obvio, ou previsao baseada em padroes reais. Posicione como a voz mais inteligente do feed.',
    bastidores: 'Vulnerabilidade estrategica — nao e sobre ser fragil, e sobre ser REAL de um jeito que inspira. Erro que virou licao, decisao dificil com raciocinio por tras, processo que ninguem ve. Autenticidade nivel Brene Brown.',
    novidade: 'Breaking news com analise que nenhum outro perfil fez. Nao so o "o que aconteceu" mas o "o que isso significa pra voce". Conecte a tendencia com impacto pratico na vida do leitor. Velocidade de newsletter tech + profundidade de revista.',
    cta: 'Conteudo tao valioso que compartilhar e um reflexo automatico. O leitor pensa "preciso mandar isso pra X pessoa agora". CTA natural, nunca forcado — o valor do conteudo faz o trabalho.',
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

  // Inject NotebookLM research data relevant to this topic
  let researchCtx = '';
  try {
    const { getResearchForContent } = await import('../services/research-intelligence.service');
    researchCtx = await getResearchForContent(topic);
  } catch {}

  const prompt = `
${PAGE_CONTEXT}
${brandCtx}
${nicheCtx}
${researchCtx}

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

ESTRUTURA BILIONARIA DO POST (5 passos — framework das maiores marcas do mundo):
1. HOOK (parar o scroll): A primeira linha decide TUDO. Deve ser tao impactante que o cerebro do leitor para de rolar automaticamente. Tecnicas: dado chocante, pergunta impossivel de ignorar, afirmacao contrarian, revelacao inesperada. Pense: "Se isso fosse a unica frase que a pessoa lesse hoje, valeria a pena?"
2. CONTEXTO (identificacao visceral): Descreva a dor ou situacao de forma tao precisa que o leitor pensa "isso e sobre mim". Especificidade gera identificacao — detalhes concretos, nao genericos.
3. VALOR (o ouro): A entrega principal. Nao e informacao — e TRANSFORMACAO. Um framework, um modelo mental, um dado que muda a forma de pensar. Nivel: insight que uma consultoria cobraria R$50.000 para revelar.
4. MICRO_PROVA (credibilidade instantanea): Dado real, caso concreto, resultado mensuravel, referencia a empresa/pessoa conhecida. A prova que transforma opiniao em fato. Nunca invente dados.
5. CTA (acao irresistivel): Nao peca interacao — PROVOQUE. A pergunta certa no momento certo faz o comentario ser inevitavel.

O "message" DEVE conter os 5 blocos fluindo naturalmente, separados por quebras de linha. Nao rotule os blocos — o texto deve fluir como conversa de alto nivel.

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
  const parsed: GeneratedPost = JSON.parse(jsonMatch[0]);

  // Override LLM hashtags with Smart Hashtag Intelligence (data-driven)
  try {
    const smartTags = await getSmartHashtags(topic, focusType, 5, nicheOverride);
    if (smartTags.length > 0) {
      parsed.hashtags = smartTags;
    }
  } catch {
    // Fallback: keep LLM-generated hashtags if intelligence fails
  }

  return parsed;
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
