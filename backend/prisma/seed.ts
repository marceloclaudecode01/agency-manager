import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@agency.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@agency.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'gerente@agency.com' },
    update: {},
    create: {
      name: 'Carlos Gerente',
      email: 'gerente@agency.com',
      password: managerPassword,
      role: 'MANAGER',
    },
  });

  // Create member user
  const memberPassword = await bcrypt.hash('member123', 10);
  const member = await prisma.user.upsert({
    where: { email: 'membro@agency.com' },
    update: {},
    create: {
      name: 'Ana Designer',
      email: 'membro@agency.com',
      password: memberPassword,
      role: 'MEMBER',
    },
  });

  // Create clients
  const client1 = await prisma.client.create({
    data: {
      name: 'TechCorp Brasil',
      email: 'contato@techcorp.com.br',
      phone: '(11) 99999-1234',
      company: 'TechCorp Tecnologia Ltda',
      status: 'ACTIVE',
      notes: 'Cliente desde 2024. Foco em marketing digital B2B.',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: 'Café & Companhia',
      email: 'marketing@cafecompanhia.com',
      phone: '(21) 98888-5678',
      company: 'Café & Companhia EIRELI',
      status: 'ACTIVE',
      notes: 'Rede de cafeterias. Foco em redes sociais e influenciadores.',
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name: 'FitLife Academia',
      email: 'mkt@fitlife.com.br',
      phone: '(31) 97777-9012',
      company: 'FitLife Saúde e Bem-estar S.A.',
      status: 'LEAD',
      notes: 'Prospect interessado em campanhas de Google Ads.',
    },
  });

  // Create campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      name: 'Lançamento App Mobile',
      description: 'Campanha de lançamento do novo aplicativo mobile da TechCorp',
      clientId: client1.id,
      status: 'ACTIVE',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-04-15'),
      budget: 25000,
      goals: 'Alcançar 10.000 downloads no primeiro mês',
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      name: 'Social Media Q1 2026',
      description: 'Gestão de redes sociais para o primeiro trimestre',
      clientId: client2.id,
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      budget: 12000,
      goals: 'Aumentar engajamento em 30% no Instagram',
    },
  });

  const campaign3 = await prisma.campaign.create({
    data: {
      name: 'Rebranding Visual',
      description: 'Redesign completo da identidade visual',
      clientId: client1.id,
      status: 'PLANNING',
      budget: 18000,
      goals: 'Nova identidade visual até abril 2026',
    },
  });

  // Create tasks
  await prisma.task.createMany({
    data: [
      { title: 'Criar wireframes do app', description: 'Wireframes de todas as telas principais', status: 'DONE', priority: 'HIGH', assigneeId: member.id, campaignId: campaign1.id, dueDate: new Date('2026-02-01') },
      { title: 'Design UI do app', description: 'Desenvolver todas as telas em alta fidelidade', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: member.id, campaignId: campaign1.id, dueDate: new Date('2026-02-28') },
      { title: 'Landing page de pré-lançamento', status: 'TODO', priority: 'MEDIUM', assigneeId: member.id, campaignId: campaign1.id, dueDate: new Date('2026-03-10') },
      { title: 'Campanha Google Ads', description: 'Configurar e otimizar campanhas de Google Ads', status: 'TODO', priority: 'URGENT', assigneeId: manager.id, campaignId: campaign1.id, dueDate: new Date('2026-03-15') },
      { title: 'Criar calendário editorial', description: 'Planejamento de posts para Janeiro-Março', status: 'DONE', priority: 'HIGH', assigneeId: manager.id, campaignId: campaign2.id, dueDate: new Date('2026-01-10') },
      { title: 'Produção de conteúdo - Fevereiro', status: 'IN_PROGRESS', priority: 'MEDIUM', assigneeId: member.id, campaignId: campaign2.id, dueDate: new Date('2026-02-25') },
      { title: 'Relatório de métricas Janeiro', status: 'DONE', priority: 'LOW', assigneeId: manager.id, campaignId: campaign2.id },
      { title: 'Briefing de rebranding', description: 'Levantar requisitos e referências', status: 'TODO', priority: 'MEDIUM', campaignId: campaign3.id },
    ],
  });

  // Create budgets
  const budget1 = await prisma.budget.create({
    data: {
      clientId: client1.id,
      campaignId: campaign1.id,
      total: 25000,
      status: 'APPROVED',
      items: [
        { description: 'Design UI/UX', value: 8000 },
        { description: 'Google Ads', value: 10000 },
        { description: 'Landing Page', value: 4000 },
        { description: 'Gestão de Projeto', value: 3000 },
      ],
    },
  });

  const budget2 = await prisma.budget.create({
    data: {
      clientId: client2.id,
      campaignId: campaign2.id,
      total: 12000,
      status: 'APPROVED',
      items: [
        { description: 'Gestão de Redes Sociais', value: 6000 },
        { description: 'Produção de Conteúdo', value: 4000 },
        { description: 'Relatórios Mensais', value: 2000 },
      ],
    },
  });

  await prisma.budget.create({
    data: {
      clientId: client1.id,
      campaignId: campaign3.id,
      total: 18000,
      status: 'SENT',
      items: [
        { description: 'Pesquisa e Briefing', value: 3000 },
        { description: 'Design de Logo', value: 5000 },
        { description: 'Brand Guide', value: 6000 },
        { description: 'Material Gráfico', value: 4000 },
      ],
    },
  });

  // Create invoices
  await prisma.invoice.create({
    data: {
      clientId: client1.id,
      budgetId: budget1.id,
      amount: 12500,
      status: 'PAID',
      dueDate: new Date('2026-02-01'),
      paidAt: new Date('2026-01-28'),
    },
  });

  await prisma.invoice.create({
    data: {
      clientId: client1.id,
      budgetId: budget1.id,
      amount: 12500,
      status: 'PENDING',
      dueDate: new Date('2026-03-01'),
    },
  });

  await prisma.invoice.create({
    data: {
      clientId: client2.id,
      budgetId: budget2.id,
      amount: 4000,
      status: 'PAID',
      dueDate: new Date('2026-01-15'),
      paidAt: new Date('2026-01-15'),
    },
  });

  await prisma.invoice.create({
    data: {
      clientId: client2.id,
      budgetId: budget2.id,
      amount: 4000,
      status: 'PAID',
      dueDate: new Date('2026-02-15'),
      paidAt: new Date('2026-02-14'),
    },
  });

  await prisma.invoice.create({
    data: {
      clientId: client2.id,
      budgetId: budget2.id,
      amount: 4000,
      status: 'PENDING',
      dueDate: new Date('2026-03-15'),
    },
  });

  // Create calendar events
  await prisma.calendarEvent.createMany({
    data: [
      { title: 'Reunião de kickoff - TechCorp', type: 'MEETING', date: new Date('2026-02-24T10:00:00'), endDate: new Date('2026-02-24T11:00:00'), campaignId: campaign1.id, userId: admin.id },
      { title: 'Entrega wireframes', type: 'DELIVERY', date: new Date('2026-02-01T18:00:00'), campaignId: campaign1.id, userId: member.id },
      { title: 'Prazo - Design UI completo', type: 'DEADLINE', date: new Date('2026-02-28T23:59:00'), campaignId: campaign1.id, userId: member.id },
      { title: 'Review mensal - Café & Companhia', type: 'MEETING', date: new Date('2026-02-26T14:00:00'), endDate: new Date('2026-02-26T15:00:00'), campaignId: campaign2.id, userId: manager.id },
      { title: 'Prazo - Conteúdo Março', type: 'DEADLINE', date: new Date('2026-03-05T23:59:00'), campaignId: campaign2.id, userId: member.id },
    ],
  });

  console.log('Seed completed successfully!');
  console.log('\nCredentials:');
  console.log('  Admin: admin@agency.com / admin123');
  console.log('  Manager: gerente@agency.com / manager123');
  console.log('  Member: membro@agency.com / member123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
