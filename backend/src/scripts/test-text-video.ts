/**
 * Test Premium Video v3 — Ken Burns + Text + Music
 * Usage: npx tsx src/scripts/test-text-video.ts
 */

import { generatePremiumVideo } from '../services/video-from-text.service';
import * as fs from 'fs';

const TEST_POSTS = [
  {
    topic: 'Inteligencia Artificial no Mercado',
    message: `97% das empresas que ignoram IA vao ficar pra tras em 3 anos\n\nUm estudo recente da McKinsey revelou que empresas que adotaram IA cedo tiveram crescimento 2.5x maior que as concorrentes. O segredo nao e a tecnologia em si — e a mentalidade de experimentacao constante.\n\nVoce ja esta usando IA no seu dia a dia? Comenta como!`,
    category: 'educativo',
  },
  {
    topic: 'Lideranca e Decisao',
    message: `A pior decisao e nao decidir\n\nLideres mediocres esperam ter 100% das informacoes. Lideres extraordinarios decidem com 70% e corrigem no caminho. Jeff Bezos chama isso de "decisoes tipo 2" — reversiveis e rapidas.\n\nQual foi a melhor decisao que voce tomou sem ter certeza?`,
    category: 'autoridade',
  },
  {
    topic: 'Produtividade Real',
    message: `Para de confundir estar ocupado com ser produtivo\n\nAs pessoas mais produtivas do mundo trabalham menos horas que voce. A diferenca? Elas protegem 4 horas por dia de foco profundo. Sem reunioes, sem notificacoes, sem interrupcoes.\n\nSalva esse post — voce vai precisar.`,
    category: 'dica_pratica',
  },
];

async function main() {
  console.log('\n=== PREMIUM VIDEO v3 (Ken Burns + Text + Music) ===\n');

  // Test 1: Without image (dark bg fallback + music)
  console.log('--- Mode 1: Dark background + text + music ---\n');
  for (let i = 0; i < TEST_POSTS.length; i++) {
    const post = TEST_POSTS[i];
    console.log(`Video ${i + 1}: "${post.topic}" [${post.category}]`);

    try {
      const start = Date.now();
      const result = await generatePremiumVideo(post.message, post.topic, post.category);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const sizeKB = (fs.statSync(result.videoPath).size / 1024).toFixed(0);

      console.log(`  [OK] ${elapsed}s, ${sizeKB}KB, music: ${result.musicMood}, image: ${result.hasImage}`);
      console.log(`  Hook: "${result.slides.hook.substring(0, 60)}..."`);
      console.log(`  -> ${result.videoPath}\n`);
    } catch (err: any) {
      console.log(`  [FAIL] ${err.message}\n`);
    }
  }

  // Test 2: With background image (Ken Burns + gradient + text + music)
  console.log('--- Mode 2: Ken Burns image + gradient + text + music ---\n');
  const testImageUrl = 'https://picsum.photos/1080/1920';
  const post = TEST_POSTS[0];
  console.log(`Video with image: "${post.topic}" [${post.category}]`);
  console.log(`  Image: ${testImageUrl}`);

  try {
    const start = Date.now();
    const result = await generatePremiumVideo(post.message, post.topic, post.category, testImageUrl);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const sizeKB = (fs.statSync(result.videoPath).size / 1024).toFixed(0);

    console.log(`  [OK] ${elapsed}s, ${sizeKB}KB, music: ${result.musicMood}, image: ${result.hasImage}`);
    console.log(`  -> ${result.videoPath}\n`);
  } catch (err: any) {
    console.log(`  [FAIL] ${err.message}\n`);
  }

  console.log('=== DONE ===');
  console.log('Open videos with VLC to verify: Ken Burns motion, text overlay, ambient music.\n');
}

main().catch(console.error);
