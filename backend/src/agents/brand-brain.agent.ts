import prisma from '../config/database';

const DEFAULT_BRAND: Record<string, string> = {
  tom_de_voz: 'Descontraído, animado e próximo do público. Use linguagem informal brasileira.',
  persona: 'Somos a NewPlay Tv Online — entretenimento, TV online, streaming e cultura pop.',
  valores: 'Entretenimento acessível, comunidade, inovação, diversão.',
  posicionamento: 'O melhor destino para quem ama TV online e streaming no Brasil.',
  palavras_proibidas: 'pirata, ilegal, grátis, crack, torrent, hack',
  emojis_preferidos: '🎬 📺 🍿 🔥 ✨ 🎉 💥',
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
IMPORTANTE: Sempre siga estas guidelines ao gerar qualquer texto.`;
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
