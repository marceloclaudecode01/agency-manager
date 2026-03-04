const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.agent.upsert({
  where: { name: 'Video Processor' },
  create: { name: 'Video Processor', function: 'video-processor', description: 'ComfyDeploy video generation polling', autonomyLevel: 5, cronExpression: '*/2 * * * *', status: 'active' },
  update: { function: 'video-processor', cronExpression: '*/2 * * * *' },
}).then(a => console.log('Agent seeded:', a.name))
  .catch(e => console.error('Seed error:', e.message))
  .finally(() => p.$disconnect());
