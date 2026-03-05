/**
 * Test Content Atomizer — 1 Post → 5 Formats
 * Usage: npx tsx src/scripts/test-atomizer.ts
 */

import { atomizePost } from '../services/content-atomizer.service';
import { PostStructure } from '../agents/content-creator.agent';

const TEST_CASES = [
  {
    name: 'Post com estrutura completa',
    topic: 'Inteligencia Artificial no Mercado',
    message: `97% das empresas que ignoram IA vao ficar pra tras em 3 anos\n\nA maioria dos CEOs sabe que precisa de IA mas nao sabe por onde comecar. Investem em ferramentas antes de investir em mentalidade.\n\nO segredo das empresas que crescem 2.5x mais rapido: experimentacao constante. Elas testam 10 hipoteses por semana enquanto voce planeja 1 por mes.\n\nUm estudo da McKinsey com 1.200 empresas mostrou que as early adopters de IA tiveram ROI 3x maior nos primeiros 18 meses.\n\nVoce ja usa IA no seu dia a dia? Comenta como — quero saber.`,
    structure: {
      hook: '97% das empresas que ignoram IA vao ficar pra tras em 3 anos',
      contexto: 'A maioria dos CEOs sabe que precisa de IA mas nao sabe por onde comecar. Investem em ferramentas antes de investir em mentalidade.',
      valor: 'O segredo das empresas que crescem 2.5x mais rapido: experimentacao constante. Elas testam 10 hipoteses por semana enquanto voce planeja 1 por mes.',
      micro_prova: 'Um estudo da McKinsey com 1.200 empresas mostrou que as early adopters de IA tiveram ROI 3x maior nos primeiros 18 meses.',
      cta: 'Voce ja usa IA no seu dia a dia? Comenta como — quero saber.',
    } as PostStructure,
  },
  {
    name: 'Post sem estrutura (texto corrido)',
    topic: 'Produtividade Real',
    message: `Para de confundir estar ocupado com ser produtivo\n\nAs pessoas mais produtivas do mundo trabalham menos horas que voce. A diferenca? Elas protegem 4 horas por dia de foco profundo. Sem reunioes, sem notificacoes, sem interrupcoes.\n\nSalva esse post — voce vai precisar.`,
    structure: undefined,
  },
  {
    name: 'Post curto',
    topic: 'Lideranca',
    message: 'A pior decisao e nao decidir. Lideres extraordinarios decidem com 70% das informacoes e corrigem no caminho.',
    structure: undefined,
  },
];

async function main() {
  console.log('\n=== CONTENT ATOMIZER TEST (1 → 5 formats, ZERO tokens) ===\n');

  for (const tc of TEST_CASES) {
    console.log(`\n━━━ ${tc.name}: "${tc.topic}" ━━━\n`);

    const start = Date.now();
    const atomized = atomizePost(tc.message, tc.topic, tc.structure || null);
    const elapsed = Date.now() - start;

    // 1. Carousel
    console.log(`📸 CARROSSEL (${atomized.carousel.slides.length} slides):`);
    for (const slide of atomized.carousel.slides) {
      console.log(`   Slide ${slide.slideNumber} [${slide.type}]: ${slide.title}`);
      if (slide.body) console.log(`      ${slide.body.substring(0, 80)}...`);
    }
    console.log(`   Caption: "${atomized.carousel.caption.substring(0, 80)}..."`);

    // 2. Video
    console.log(`\n🎬 VIDEO (3 slides):`);
    console.log(`   Hook: "${atomized.video.hook.substring(0, 80)}"`);
    console.log(`   Value: "${atomized.video.value.substring(0, 80)}"`);
    console.log(`   CTA: "${atomized.video.cta}"`);

    // 3. Thread
    console.log(`\n🧵 THREAD (${atomized.thread.posts.length} posts):`);
    for (const post of atomized.thread.posts) {
      console.log(`   ${post.substring(0, 100)}${post.length > 100 ? '...' : ''}`);
    }

    // 4. Ad Copy
    console.log(`\n📢 AD COPY:`);
    console.log(`   Headline: "${atomized.adCopy.headline}"`);
    console.log(`   Primary: "${atomized.adCopy.primaryText.substring(0, 100)}"`);
    console.log(`   Description: "${atomized.adCopy.description}"`);
    console.log(`   CTA Button: ${atomized.adCopy.cta}`);

    console.log(`\n   ⏱️ Atomizado em ${elapsed}ms (ZERO tokens)`);
  }

  console.log('\n\n=== DONE — 0 LLM calls, 0 API calls, 0 tokens consumed ===\n');
}

main().catch(console.error);
