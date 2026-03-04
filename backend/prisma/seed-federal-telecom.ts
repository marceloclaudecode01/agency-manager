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
        niche: 'telecom',
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
      niche: 'telecom',
      status: 'ACTIVE',
      isActive: true,
      facebookPageName: 'Federal Associados',
      // IMPORTANT: Set these via Railway env vars or manual update:
      // facebookPageId: 'YOUR_PAGE_ID_HERE',
      // facebookAccessToken: 'YOUR_PAGE_TOKEN_HERE',
      notes: 'Vendas de planos de internet móvel - Federal Associados e Federal Telecom. Configure facebookPageId e facebookAccessToken após criar o app no Facebook Dev.',
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
