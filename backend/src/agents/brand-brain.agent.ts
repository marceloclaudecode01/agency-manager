import prisma from '../config/database';

const DEFAULT_BRAND: Record<string, string> = {
  tom_de_voz: 'Inteligente, direto, provocativo e humano. Alterna entre educativo, inspirador e descontraído. Linguagem informal brasileira.',
  persona: 'Somos uma página de conteúdo de alto valor — frameworks aplicáveis, dados reais, insights contra-intuitivos e conhecimento que transforma. Autoridade com profundidade técnica, nunca superficialidade motivacional.',
  regra_qualidade: 'PROIBIDO posts motivacionais genéricos sem dado concreto, framework aplicável ou insight contra-intuitivo. Cada post DEVE ensinar algo que o leitor NÃO sabia. Frases como "desperte seu potencial", "mude sua vida", "você é capaz" SÃO PROIBIDAS sem contexto específico.',
  valores: 'Valor real, crescimento pessoal, conhecimento prático, comunidade engajada, autenticidade.',
  posicionamento: 'Referência em conteúdo útil, surpreendente e compartilhável. Cada post entrega algo que vale salvar.',
  palavras_proibidas: 'pirata, ilegal, crack, torrent, hack, clickbait vazio, spam',
  emojis_preferidos: 'NAO usar emojis — texto puro e direto, apenas caracteres ASCII',
  nicho_proibido: 'NÃO produzir conteúdo sobre streamers, filmes, séries ou entretenimento genérico.',
  estrategia_conteudo: 'Distribuição: 40% educativo, 30% engajamento/interação, 20% autoridade/prova social, 10% pessoal/bastidores.',
  pilares_tematicos: `1. Liderança & Estratégia (tendências globais, crescimento exponencial, decisão baseada em dados, alta performance)
2. Tecnologia & Inovação (IA, automação, ecossistemas digitais, transformação digital)
3. Performance & Resultados (estudos de caso, métricas reais, escalabilidade, ROI)
4. Cultura & Propósito (visão de futuro, impacto social, cultura organizacional, branding global)`,
};

export async function getBrandContext(): Promise<string> {
  try {
    const configs = await prisma.brandConfig.findMany();
    const brand: Record<string, string> = { ...DEFAULT_BRAND };

    for (const c of configs) {
      brand[c.key] = c.value;
    }

    return `
BRAND GUIDELINES:
- Tom de voz: ${brand.tom_de_voz}
- Persona: ${brand.persona}
- Valores: ${brand.valores}
- Posicionamento: ${brand.posicionamento}
- Palavras proibidas: ${brand.palavras_proibidas}
- Emojis preferidos: ${brand.emojis_preferidos}
- RESTRIÇÃO DE NICHO: ${brand.nicho_proibido || ''}
- REGRA DE QUALIDADE: ${brand.regra_qualidade || ''}
- Estratégia de conteúdo: ${brand.estrategia_conteudo || ''}
- PILARES TEMÁTICOS (todo conteúdo DEVE se encaixar em um destes):
${brand.pilares_tematicos || ''}
IMPORTANTE: Sempre siga estas guidelines. NUNCA produza conteúdo sobre filmes, séries, streaming ou entretenimento genérico. Todo post deve estar alinhado a um dos 4 pilares temáticos. Posts motivacionais genéricos sem substância são PROIBIDOS.`;
  } catch {
    return '';
  }
}

export async function seedBrandConfig(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_BRAND)) {
    await prisma.brandConfig.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}

export async function updateBrandConfig(key: string, value: string): Promise<void> {
  await prisma.brandConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAllBrandConfig(): Promise<Record<string, string>> {
  const configs = await prisma.brandConfig.findMany();
  const result: Record<string, string> = { ...DEFAULT_BRAND };
  for (const c of configs) {
    result[c.key] = c.value;
  }
  return result;
}
