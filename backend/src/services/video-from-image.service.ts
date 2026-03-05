/**
 * Video From Image Service — Creates MP4 videos from AI-generated images
 *
 * Uses ffmpeg (already installed via ffmpeg-static) to create animated videos
 * with Ken Burns effect (zoom + pan) from Pollinations AI images.
 *
 * No external API needed — runs entirely on the server.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic as string);

const VIDEO_DURATION = 6; // seconds
const VIDEO_FPS = 30;
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 720;

// Cinematic Ken Burns effects — premium motion inspired by documentary filmmaking
// Each effect creates a different emotional response through camera movement
const EFFECTS = [
  // Dramatic slow zoom in — builds tension and focus (Spielberg reveal)
  `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Elegant zoom out — reveals context and scale (Nolan wide reveal)
  `zoompan=z='if(eq(on,1),1.3,max(zoom-0.001,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Smooth pan left to right — narrative movement (documentary tracking)
  `zoompan=z='min(zoom+0.0005,1.15)':x='if(eq(on,1),0,min(x+2,iw))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Smooth pan right to left — reverse narrative (editorial panning)
  `zoompan=z='min(zoom+0.0005,1.15)':x='if(eq(on,1),iw/4,max(x-2,0))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Intimate top-left focus zoom — draws eye to detail (macro documentary)
  `zoompan=z='min(zoom+0.0015,1.5)':x='0':y='0':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Dramatic bottom-right reveal — unexpected focal point (editorial style)
  `zoompan=z='min(zoom+0.0015,1.5)':x='iw-(iw/zoom)':y='ih-(ih/zoom)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Diagonal drift (top-left to center) with gentle zoom — cinematic elegance
  `zoompan=z='min(zoom+0.0008,1.25)':x='if(eq(on,1),0,min(x+1,iw/2-(iw/zoom/2)))':y='if(eq(on,1),0,min(y+1,ih/2-(ih/zoom/2)))':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Center-out zoom with slight upward drift — aspirational feel (Apple style)
  `zoompan=z='if(eq(on,1),1.4,max(zoom-0.0012,1))':x='iw/2-(iw/zoom/2)':y='if(eq(on,1),ih/2-(ih/zoom/2),max(y-0.5,0))':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Slow push into center-right — power composition (Red Bull intensity)
  `zoompan=z='min(zoom+0.0012,1.35)':x='if(eq(on,1),iw/3,min(x+0.5,iw/2-(iw/zoom/2)))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Wide zoom out from golden ratio point — premium reveal (luxury brand style)
  `zoompan=z='if(eq(on,1),1.5,max(zoom-0.0015,1))':x='iw*0.618-(iw/zoom/2)':y='ih*0.382-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
];

let effectIndex = 0;

function getNextEffect(): string {
  const effect = EFFECTS[effectIndex % EFFECTS.length];
  effectIndex++;
  return effect;
}

/**
 * Wait helper
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Download image from URL to temp file with retry logic.
 * Pollinations generates images on-demand — first request triggers generation
 * which can take 30-60s. We pre-warm, then retry with increasing delays.
 */
async function downloadImage(url: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `agency_img_${Date.now()}.jpg`);
  const MAX_RETRIES = 4;
  const RETRY_DELAYS = [0, 15000, 20000, 30000]; // 0s, 15s, 20s, 30s

  // Pre-warm: fire a HEAD request to trigger Pollinations image generation
  try {
    await axios.head(url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch {
    // Expected — Pollinations may not support HEAD or it may timeout while generating
  }

  // Wait for image generation to start
  await wait(10000);

  let lastError: any;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt] || 20000;
      console.log(`[VideoFromImage] Retry ${attempt}/${MAX_RETRIES - 1}, waiting ${delay / 1000}s...`);
      await wait(delay);
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000, // 90s timeout — Pollinations can be slow
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgencyBot/1.0)' },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      // Verify we got actual image data (not an error page)
      if (response.data.length < 5000) {
        throw new Error(`Response too small (${response.data.length} bytes) — likely not an image`);
      }

      fs.writeFileSync(tmpFile, response.data);
      return tmpFile;
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status || 'network';
      console.log(`[VideoFromImage] Download attempt ${attempt + 1} failed: ${status} — ${err.message}`);
    }
  }

  throw new Error(`Failed to download image after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Create video from image using ffmpeg Ken Burns effect
 */
function createVideoFromImage(imagePath: string, outputPath: string, effect: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .loop(VIDEO_DURATION)
      .inputOptions(['-framerate', '1'])
      .videoFilter(effect)
      .outputOptions([
        '-c:v', 'libx264',
        '-t', String(VIDEO_DURATION),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-preset', 'fast',
        '-crf', '23',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

/**
 * Main function: Generate a video from a Pollinations AI image
 * Returns the path to the generated MP4 file
 */
export async function generateVideoFromImage(imageUrl: string): Promise<{ videoPath: string; effect: string }> {
  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `agency_video_${Date.now()}.mp4`);

  // Download the AI image
  const imagePath = await downloadImage(imageUrl);

  try {
    // Pick next Ken Burns effect (rotates through all effects)
    const effect = getNextEffect();

    // Create video with ffmpeg
    await createVideoFromImage(imagePath, videoPath, effect);

    // Verify the video was created
    const stats = fs.statSync(videoPath);
    if (stats.size < 10000) {
      throw new Error(`Video too small: ${stats.size} bytes`);
    }

    return { videoPath, effect };
  } finally {
    // Clean up temp image
    try { fs.unlinkSync(imagePath); } catch {}
  }
}

/**
 * Generate video and upload to Cloudinary
 * Returns the Cloudinary video URL ready for Facebook publishing
 */
export async function generateAndUploadVideo(imageUrl: string): Promise<string> {
  const { videoPath } = await generateVideoFromImage(imageUrl);

  try {
    // Upload to Cloudinary
    const { uploadVideoFromUrl } = await import('../config/cloudinary');
    const uploaded = await uploadVideoFromUrl(videoPath, 'agency-videos');

    return uploaded.url;
  } finally {
    // Clean up temp video
    try { fs.unlinkSync(videoPath); } catch {}
  }
}
