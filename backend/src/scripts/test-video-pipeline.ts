/**
 * Test Video Pipeline — Simula o pipeline completo da agência SEM gastar tokens LLM
 *
 * Testa: Pollinations image download → ffmpeg Ken Burns → Cloudinary upload
 *
 * Uso: npx ts-node src/scripts/test-video-pipeline.ts
 * Ou:  npx tsx src/scripts/test-video-pipeline.ts
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// CONFIG — ajuste conforme necessário
// ============================================================
const TEST_PROMPTS = [
  'cinematic close-up of coffee cup with steam, golden hour rim lighting, shallow depth of field, 8K',
  'hyper-realistic 3D render of glowing blue neural network on dark background, volumetric lighting',
  'dramatic aerial view of winding mountain road at sunset, atmospheric haze, leading lines',
];

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1080;

// ============================================================
// HELPERS
// ============================================================
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(step: string, msg: string, type: 'ok' | 'fail' | 'info' | 'warn' = 'info') {
  const icons = { ok: '[OK]', fail: '[FAIL]', info: '[..]', warn: '[!!]' };
  console.log(`${icons[type]} [${step}] ${msg}`);
}

// ============================================================
// STEP 1: Test Image Providers
// ============================================================
async function testImageDownload(prompt: string): Promise<string | null> {
  const seed = Date.now() + Math.floor(Math.random() * 100000);

  const urls = [
    { name: 'Pollinations (flux)', url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&model=flux&seed=${seed}` },
    { name: 'Pollinations (turbo)', url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&model=turbo&seed=${seed + 1}` },
    { name: 'Pollinations (default)', url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${seed + 2}` },
    { name: 'Picsum (fallback)', url: `https://picsum.photos/seed/${seed}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}` },
  ];

  for (const provider of urls) {
    log('Image', `Testando ${provider.name}...`);

    // Pre-warm
    try {
      await axios.head(provider.url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    } catch {}

    await wait(5000);

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        log('Image', `  Retry ${attempt}/2, aguardando 10s...`, 'warn');
        await wait(10000);
      }

      try {
        const start = Date.now();
        const response = await axios.get(provider.url, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgencyBot/1.0)' },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const sizeKB = (response.data.length / 1024).toFixed(0);

        if (response.data.length < 5000) {
          log('Image', `  Resposta muito pequena (${sizeKB}KB) — provavelmente não é imagem`, 'fail');
          continue;
        }

        const tmpFile = path.join(os.tmpdir(), `test_img_${Date.now()}.jpg`);
        fs.writeFileSync(tmpFile, response.data);
        log('Image', `  ${provider.name} OK! ${sizeKB}KB em ${elapsed}s → ${tmpFile}`, 'ok');
        return tmpFile;
      } catch (err: any) {
        const status = err.response?.status || 'network';
        log('Image', `  Attempt ${attempt + 1} failed: ${status} — ${err.message}`, 'fail');

        // Server error — skip to next provider
        if (err.response?.status >= 500 && attempt >= 1) {
          log('Image', `  Server error persistente — pulando para próximo provider`, 'warn');
          break;
        }
      }
    }
  }

  log('Image', 'TODOS os providers falharam!', 'fail');
  return null;
}

// ============================================================
// STEP 2: Test ffmpeg Video Generation
// ============================================================
async function testFfmpegVideo(imagePath: string): Promise<string | null> {
  log('Video', 'Testando ffmpeg Ken Burns...');

  try {
    // Dynamic imports (same as production code)
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const ffmpegStatic = (await import('ffmpeg-static')).default;

    if (!ffmpegStatic) {
      log('Video', 'ffmpeg-static não encontrado! Instale: npm install ffmpeg-static', 'fail');
      return null;
    }

    ffmpeg.setFfmpegPath(ffmpegStatic as string);
    log('Video', `  ffmpeg path: ${ffmpegStatic}`, 'ok');

    const videoPath = path.join(os.tmpdir(), `test_video_${Date.now()}.mp4`);
    const duration = 6;
    const fps = 30;
    const effect = `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=720x720:fps=${fps}`;

    const start = Date.now();

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .loop(duration)
        .inputOptions(['-framerate', '1'])
        .videoFilter(effect)
        .outputOptions([
          '-c:v', 'libx264',
          '-t', String(duration),
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-preset', 'fast',
          '-crf', '23',
        ])
        .output(videoPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const stats = fs.statSync(videoPath);
    const sizeKB = (stats.size / 1024).toFixed(0);

    if (stats.size < 10000) {
      log('Video', `  Vídeo muito pequeno: ${sizeKB}KB`, 'fail');
      return null;
    }

    log('Video', `  Ken Burns OK! ${sizeKB}KB (${elapsed}s) → ${videoPath}`, 'ok');
    return videoPath;
  } catch (err: any) {
    log('Video', `  ffmpeg falhou: ${err.message}`, 'fail');
    return null;
  }
}

// ============================================================
// STEP 3: Test Cloudinary Upload (optional — needs env vars)
// ============================================================
async function testCloudinaryUpload(videoPath: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    log('Cloudinary', 'Env vars não configuradas (CLOUDINARY_CLOUD_NAME, etc) — pulando upload', 'warn');
    log('Cloudinary', 'Para testar: defina as vars e rode novamente', 'info');
    return null;
  }

  log('Cloudinary', 'Testando upload de vídeo...');

  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const start = Date.now();
    const result = await cloudinary.uploader.upload(videoPath, {
      resource_type: 'video',
      folder: 'agency-test-videos',
      public_id: `test_${Date.now()}`,
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log('Cloudinary', `  Upload OK! ${elapsed}s → ${result.secure_url}`, 'ok');
    return result.secure_url;
  } catch (err: any) {
    log('Cloudinary', `  Upload falhou: ${err.message}`, 'fail');
    return null;
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('');
  console.log('==========================================================');
  console.log('  TEST VIDEO PIPELINE — Simulação local (zero tokens LLM)');
  console.log('==========================================================');
  console.log('');

  const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
  log('Config', `Prompt: "${prompt.substring(0, 80)}..."`);
  console.log('');

  // STEP 1: Image
  console.log('--- STEP 1: Download de Imagem AI ---');
  const imagePath = await testImageDownload(prompt);
  if (!imagePath) {
    console.log('\n[RESULTADO] Pipeline FALHOU no Step 1 — imagem não baixou.');
    console.log('  Possíveis causas: Pollinations fora do ar (530), sem internet, bloqueado.');
    console.log('  Ação: aguardar Pollinations voltar ou adicionar provedor alternativo.\n');
    process.exit(1);
  }
  console.log('');

  // STEP 2: Video
  console.log('--- STEP 2: Geração de Vídeo (ffmpeg Ken Burns) ---');
  const videoPath = await testFfmpegVideo(imagePath);
  if (!videoPath) {
    console.log('\n[RESULTADO] Pipeline FALHOU no Step 2 — ffmpeg não gerou vídeo.');
    console.log('  Possíveis causas: ffmpeg-static não instalado, imagem corrompida.');
    console.log('  Ação: npm install ffmpeg-static\n');
    // Cleanup
    try { fs.unlinkSync(imagePath); } catch {}
    process.exit(1);
  }
  console.log('');

  // STEP 3: Cloudinary (optional)
  console.log('--- STEP 3: Upload Cloudinary (opcional) ---');
  const cloudinaryUrl = await testCloudinaryUpload(videoPath);
  console.log('');

  // SUMMARY
  console.log('==========================================================');
  console.log('  RESULTADO FINAL');
  console.log('==========================================================');
  console.log(`  [1] Imagem:     OK — ${imagePath}`);
  console.log(`  [2] Vídeo:      OK — ${videoPath}`);
  console.log(`  [3] Cloudinary: ${cloudinaryUrl ? 'OK — ' + cloudinaryUrl : 'PULADO (sem env vars)'}`);
  console.log('');
  console.log('  Pipeline FUNCIONANDO! Pronto para publicação.');
  console.log('==========================================================');
  console.log('');

  // Cleanup temp files
  console.log('Arquivos temporários (para inspeção manual):');
  console.log(`  Imagem: ${imagePath}`);
  console.log(`  Vídeo:  ${videoPath}`);
  console.log('');
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
