/**
 * Test Text Video v2 — Premium vertical videos (1080x1920)
 * Usage: npx tsx src/scripts/test-text-video.ts
 */

import { generateTextVideo, generateTextVideoFromSlides } from '../services/video-from-text.service';
import { atomizePost } from '../services/content-atomizer.service';
import * as fs from 'fs';

const TEST_POSTS = [
  {
    topic: 'Inteligencia Artificial no Mercado',
    message: `97% das empresas que ignoram IA vao ficar pra tras em 3 anos\n\nUm estudo recente da McKinsey revelou que empresas que adotaram IA cedo tiveram crescimento 2.5x maior que as concorrentes. O segredo nao e a tecnologia em si — e a mentalidade de experimentacao constante.\n\nVoce ja esta usando IA no seu dia a dia? Comenta como!`,
  },
  {
    topic: 'Lideranca e Decisao',
    message: `A pior decisao e nao decidir\n\nLideres mediocres esperam ter 100% das informacoes. Lideres extraordinarios decidem com 70% e corrigem no caminho. Jeff Bezos chama isso de "decisoes tipo 2" — reversiveis e rapidas.\n\nQual foi a melhor decisao que voce tomou sem ter certeza?`,
  },
  {
    topic: 'Produtividade Real',
    message: `Para de confundir estar ocupado com ser produtivo\n\nAs pessoas mais produtivas do mundo trabalham menos horas que voce. A diferenca? Elas protegem 4 horas por dia de foco profundo. Sem reunioes, sem notificacoes, sem interrupcoes.\n\nSalva esse post — voce vai precisar.`,
  },
];

async function main() {
  console.log('\n=== TEST VIDEO v2 (Vertical 1080x1920, Premium) ===\n');

  // Test 1: Direct from message text
  console.log('--- Mode 1: Direct from message ---\n');
  for (let i = 0; i < TEST_POSTS.length; i++) {
    const post = TEST_POSTS[i];
    console.log(`Video ${i + 1}: "${post.topic}"`);

    try {
      const start = Date.now();
      const { videoPath, slides } = await generateTextVideo(post.message, post.topic);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const sizeKB = (fs.statSync(videoPath).size / 1024).toFixed(0);

      console.log(`  [OK] ${elapsed}s, ${sizeKB}KB`);
      console.log(`  Hook: "${slides.hook.substring(0, 60)}..."`);
      console.log(`  -> ${videoPath}\n`);
    } catch (err: any) {
      console.log(`  [FAIL] ${err.message}\n`);
    }
  }

  // Test 2: From atomizer video slides
  console.log('--- Mode 2: From atomizer slides (zero-token pipeline) ---\n');
  const post = TEST_POSTS[0];
  const atomized = atomizePost(post.message, post.topic);

  console.log(`Video from atomized slides: "${post.topic}"`);
  console.log(`  Slides: Hook="${atomized.video.hook.substring(0, 40)}..." Value="${atomized.video.value.substring(0, 40)}..." CTA="${atomized.video.cta.substring(0, 40)}"`);

  try {
    const start = Date.now();
    const { videoPath } = await generateTextVideoFromSlides(atomized.video, post.topic);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const sizeKB = (fs.statSync(videoPath).size / 1024).toFixed(0);

    console.log(`  [OK] ${elapsed}s, ${sizeKB}KB`);
    console.log(`  -> ${videoPath}\n`);
  } catch (err: any) {
    console.log(`  [FAIL] ${err.message}\n`);
  }

  console.log('=== DONE ===');
  console.log('Abra os videos com VLC para verificar qualidade (formato vertical 1080x1920).\n');
}

main().catch(console.error);
