/**
 * Test FULL video pipeline: text → video → Cloudinary upload
 * Simula exatamente o que a agência faz em produção.
 * Uso: CLOUDINARY_CLOUD_NAME=x CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x npx tsx src/scripts/test-full-video.ts
 */

import { generateTextVideo } from '../services/video-from-text.service';
import * as fs from 'fs';

async function main() {
  console.log('\n=== FULL VIDEO PIPELINE TEST ===\n');

  const post = {
    topic: 'Inteligencia Artificial e o Futuro',
    message: `97% das empresas que ignoram IA vao ficar para tras em 3 anos\n\nUm estudo recente da McKinsey revelou que empresas que adotaram IA tiveram crescimento 2.5x maior. O segredo nao e a tecnologia — e a mentalidade de experimentacao constante.\n\nVoce ja esta usando IA no seu dia a dia? Comenta como!`,
  };

  // Step 1: Generate video
  console.log('[1] Gerando video de texto animado...');
  const start = Date.now();
  const { videoPath, slides } = await generateTextVideo(post.message, post.topic);
  const genTime = ((Date.now() - start) / 1000).toFixed(1);
  const sizeKB = (fs.statSync(videoPath).size / 1024).toFixed(0);

  console.log(`    OK! ${sizeKB}KB em ${genTime}s`);
  console.log(`    Hook: "${slides.hook.substring(0, 60)}"`);
  console.log(`    Value: "${slides.value.substring(0, 60)}"`);
  console.log(`    CTA: "${slides.cta}"`);

  // Step 2: Upload to Cloudinary
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloudName) {
    console.log('\n[2] Uploading para Cloudinary...');
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploadStart = Date.now();
    const result = await cloudinary.uploader.upload(videoPath, {
      resource_type: 'video',
      folder: 'agency-videos',
      public_id: `test_text_${Date.now()}`,
    });
    const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(1);

    console.log(`    OK! Upload em ${uploadTime}s`);
    console.log(`    URL: ${result.secure_url}`);
    console.log(`\n    ^^^ Abre essa URL no navegador pra ver o video! ^^^`);
  } else {
    console.log('\n[2] Cloudinary: PULADO (sem env vars)');
    console.log(`    Video local: ${videoPath}`);
  }

  // Cleanup
  try { fs.unlinkSync(videoPath); } catch {}

  console.log('\n=== DONE ===\n');
}

main().catch(console.error);
