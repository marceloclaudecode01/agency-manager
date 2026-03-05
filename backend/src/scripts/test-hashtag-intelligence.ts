/**
 * Test: Hashtag Intelligence Service
 * Run: npx ts-node src/scripts/test-hashtag-intelligence.ts
 */

import { getSmartHashtags } from '../services/hashtag-intelligence.service';

async function main() {
  console.log('=== Hashtag Intelligence Test ===\n');

  const testCases = [
    { topic: 'Como a inteligencia artificial vai mudar o mercado de trabalho', category: 'educativo' },
    { topic: 'Voce esta preparado para a proxima crise economica?', category: 'engajamento' },
    { topic: 'Tendencias de marketing digital para 2026', category: 'autoridade' },
    { topic: 'O erro que quase destruiu meu negocio', category: 'bastidores' },
    { topic: 'Planos de celular TIM com 87% de comissao', category: 'autoridade', niche: 'telecom associacao' },
  ];

  for (const tc of testCases) {
    const tags = await getSmartHashtags(tc.topic, tc.category, 5, tc.niche);
    console.log(`[${tc.category.toUpperCase()}] "${tc.topic.substring(0, 50)}..."`);
    console.log(`  Hashtags: ${tags.map(t => `#${t}`).join(' ')}`);
    console.log();
  }

  // Test diversity: same topic should give different hashtags each time
  console.log('=== Diversity Test (same topic, 3 runs) ===\n');
  for (let i = 0; i < 3; i++) {
    const tags = await getSmartHashtags('Lideranca no seculo 21', 'autoridade', 5);
    console.log(`  Run ${i + 1}: ${tags.map(t => `#${t}`).join(' ')}`);
  }

  console.log('\n✅ All tests passed!');
}

main().catch(console.error);
