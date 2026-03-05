/**
 * Test Text Video — Simula a criação de vídeo com texto animado
 * Uso: npx tsx src/scripts/test-text-video.ts
 */

import { generateTextVideo } from '../services/video-from-text.service';
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
  console.log('\n=== TEST TEXT VIDEO (Reels/TikTok style) ===\n');

  for (let i = 0; i < TEST_POSTS.length; i++) {
    const post = TEST_POSTS[i];
    console.log(`--- Video ${i + 1}: "${post.topic}" ---`);

    try {
      const start = Date.now();
      const { videoPath, slides } = await generateTextVideo(post.message, post.topic);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const sizeKB = (fs.statSync(videoPath).size / 1024).toFixed(0);

      console.log(`[OK] Video gerado em ${elapsed}s (${sizeKB}KB)`);
      console.log(`     Hook: "${slides.hook.substring(0, 60)}..."`);
      console.log(`     Value: "${slides.value.substring(0, 60)}..."`);
      console.log(`     CTA: "${slides.cta.substring(0, 60)}"`);
      console.log(`     -> ${videoPath}`);
      console.log('');
    } catch (err: any) {
      console.log(`[FAIL] ${err.message}`);
      console.log('');
    }
  }

  console.log('=== DONE ===\n');
  console.log('Abra os videos com VLC ou qualquer player para verificar qualidade.\n');
}

main().catch(console.error);
