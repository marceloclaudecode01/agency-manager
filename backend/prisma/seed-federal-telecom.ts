import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed: Federal Associados / Federal Telecom as a client
  const existing = await prisma.client.findFirst({
    where: { name: { contains: 'Federal', mode: 'insensitive' } },
  });

  if (existing) {
    console.log(`[Seed] Federal Telecom already exists: ${existing.id}`);
    // Update fields if needed
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        facebookPageName: 'Federal Associados',
        niche: 'telecom - planos de internet fibra optica e internet movel da Federal Associados e Federal Telecom (mesmo grupo). Venda de planos residenciais e empresariais, velocidades de 100Mbps a 1Gbps, cobertura regional, atendimento ao cliente, suporte tecnico, instalacao rapida. Foco em custo-beneficio, velocidade real entregue, estabilidade da conexao, suporte humanizado. Linguagem acessivel para publico geral que busca internet de qualidade.',
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
      niche: 'telecom - planos de internet fibra optica e internet movel da Federal Associados e Federal Telecom (mesmo grupo). Venda de planos residenciais e empresariais, velocidades de 100Mbps a 1Gbps, cobertura regional, atendimento ao cliente, suporte tecnico, instalacao rapida. Foco em custo-beneficio, velocidade real entregue, estabilidade da conexao, suporte humanizado. Linguagem acessivel para publico geral que busca internet de qualidade.',
      status: 'ACTIVE',
      isActive: true,
      facebookPageName: 'Federal Associados',
      // IMPORTANT: Set these via Railway env vars or manual update:
      // facebookPageId: 'YOUR_PAGE_ID_HERE',
      // facebookAccessToken: 'YOUR_PAGE_TOKEN_HERE',
      notes: 'Vendas de planos de internet - Federal Associados e Federal Telecom (mesmo grupo). Conteudo deve focar em: planos de internet, beneficios da fibra optica, velocidade, estabilidade, custo-beneficio, comparativos, dicas de uso, suporte ao cliente.',
    },
  });

  console.log(`[Seed] Federal Telecom created: ${client.id}`);
  console.log('[Seed] NEXT STEPS:');
  console.log('  1. Get the Facebook Page ID from Facebook Dev');
  console.log('  2. Get the Page Access Token from the Facebook App');
  console.log('  3. Update the client via API or DB:');
  console.log(`     PATCH /api/clients/${client.id}`);
  console.log('     { "facebookPageId": "...", "facebookAccessToken": "..." }');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
