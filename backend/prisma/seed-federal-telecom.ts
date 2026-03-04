import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEDERAL_NICHE = `telecom associacao - Revenda de planos de celular TIM, CLARO e VIVO via Federal Associados. Modelo de associacao com comissao de 87% + 10% recorrencia mensal para afiliados. PLANOS: 15GB R$29,90 | 40GB+Ligacao Ilimitada R$49,90 | 80GB+Ligacao Ilimitada R$69,90 | Planos de 15GB ate 600GB. BENEFICIOS INCLUSOS: Internet Ilimitada, Ligacao Ilimitada, Auxilio Funeral R$3.000, Indique e Ganhe 87%, Cinema Cinesystem por mes. OPERADORAS: TIM, CLARO e VIVO. LINK CADASTRO: https://federalassociados.com.br/pbi/cadastro/107220 SITE: federalassociados.com.br. Tom: acessivel, empolgante, foco em economia e beneficios. Publico: pessoas que querem planos baratos de celular E pessoas que querem ganhar dinheiro como afiliado indicando planos.`;

const FEDERAL_NOTES = `Federal Associados - associacao de vendas de planos celular (TIM/CLARO/VIVO). Dois publicos: 1) Consumidores que querem planos baratos de celular com beneficios extras (auxilio funeral, cinema). 2) Afiliados/revendedores que querem renda extra com 87% comissao + 10% recorrencia. Conteudo deve alternar entre: divulgacao de planos/precos/beneficios E oportunidade de renda como afiliado. NUNCA inventar planos ou precos que nao existam. SEMPRE usar os valores reais.`;

async function main() {
  // Seed: Federal Associados / Federal Telecom as a client
  const existing = await prisma.client.findFirst({
    where: { name: { contains: 'Federal', mode: 'insensitive' } },
  });

  if (existing) {
    console.log(`[Seed] Federal Telecom already exists: ${existing.id}`);
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        facebookPageName: 'Federal Associados',
        niche: FEDERAL_NICHE,
        notes: FEDERAL_NOTES,
        isActive: true,
        status: 'ACTIVE',
      },
    });
    console.log('[Seed] Updated Federal Telecom fields');
    return;
  }

  const client = await prisma.client.create({
    data: {
      name: 'Federal Associados / Federal Telecom',
      company: 'Federal Telecom',
      niche: FEDERAL_NICHE,
      notes: FEDERAL_NOTES,
      status: 'ACTIVE',
      isActive: true,
      facebookPageName: 'Federal Associados',
      // IMPORTANT: Set facebookPageId and facebookAccessToken via API after creation
    },
  });

  console.log(`[Seed] Federal Telecom created: ${client.id}`);
  console.log('[Seed] NEXT STEPS:');
  console.log('  1. Get the Facebook Page ID from Facebook Dev');
  console.log('  2. Get the Page Access Token from the Facebook App');
  console.log('  3. Update the client via API:');
  console.log(`     PUT /api/clients/${client.id}`);
  console.log('     { "facebookPageId": "...", "facebookAccessToken": "..." }');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
