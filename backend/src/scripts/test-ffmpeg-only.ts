/**
 * Test ONLY ffmpeg video generation — uses a solid color image (no internet needed)
 * Uso: npx tsx src/scripts/test-ffmpeg-only.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function main() {
  console.log('\n=== TEST FFMPEG ONLY (sem internet) ===\n');

  const ffmpeg = (await import('fluent-ffmpeg')).default;
  const ffmpegStatic = (await import('ffmpeg-static')).default;

  if (!ffmpegStatic) {
    console.log('[FAIL] ffmpeg-static não encontrado');
    process.exit(1);
  }

  ffmpeg.setFfmpegPath(ffmpegStatic as string);
  console.log(`[OK] ffmpeg: ${ffmpegStatic}`);

  // Create a simple test image using ffmpeg (solid color with gradient)
  const testImage = path.join(os.tmpdir(), `test_src_${Date.now()}.png`);
  const videoPath = path.join(os.tmpdir(), `test_video_${Date.now()}.mp4`);

  console.log('[..] Gerando imagem de teste (gradient)...');

  // Generate a test image with ffmpeg
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('color=c=blue:s=1080x1080:d=1')
      .inputFormat('lavfi')
      .frames(1)
      .output(testImage)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });

  console.log(`[OK] Imagem teste: ${testImage} (${(fs.statSync(testImage).size / 1024).toFixed(0)}KB)`);

  // Now test Ken Burns
  console.log('[..] Gerando vídeo Ken Burns (6s)...');
  const start = Date.now();
  const duration = 6;
  const fps = 30;
  const effect = `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=720x720:fps=${fps}`;

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(testImage)
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
  console.log(`[OK] Vídeo gerado! ${(stats.size / 1024).toFixed(0)}KB em ${elapsed}s`);
  console.log(`     → ${videoPath}`);

  // Cleanup
  try { fs.unlinkSync(testImage); } catch {}

  console.log('\n=== FFMPEG FUNCIONA! ===\n');
  console.log(`Vídeo disponível em: ${videoPath}`);
  console.log('(abra com VLC ou qualquer player para verificar)\n');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
