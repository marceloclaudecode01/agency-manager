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
 * Extract prompt text from a Pollinations URL for fallback providers
 */
function extractPromptFromUrl(url: string): string {
  try {
    const match = url.match(/\/prompt\/(.+?)(\?|$)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {}
  return 'cinematic professional photograph, dramatic lighting, 8K quality';
}

/**
 * Build fallback image URLs from alternative free providers
 */
function getFallbackImageUrls(originalUrl: string): string[] {
  const prompt = extractPromptFromUrl(originalUrl);
  const seed = Date.now();
  return [
    // Pollinations with different model
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&model=turbo&seed=${seed}`,
    // Pollinations default model
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&seed=${seed + 1}`,
    // Picsum — high-quality real photos, always online (emergency fallback)
    `https://picsum.photos/seed/${seed}/1080/1080`,
  ];
}

/**
 * Download image from URL to temp file with retry logic and fallback providers.
 * Tries original URL first, then falls back to alternative providers if down.
 */
async function downloadImage(url: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `agency_img_${Date.now()}.jpg`);
  const urlsToTry = [url, ...getFallbackImageUrls(url)];

  for (const currentUrl of urlsToTry) {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [0, 10000, 15000];
    const isOriginal = currentUrl === url;

    if (!isOriginal) {
      console.log(`[VideoFromImage] Trying fallback URL: ${currentUrl.substring(0, 100)}...`);
    }

    // Pre-warm: fire a HEAD request to trigger image generation
    try {
      await axios.head(currentUrl, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    } catch {
      // Expected — provider may not support HEAD or may timeout while generating
    }

    // Wait for generation (shorter for fallbacks)
    await wait(isOriginal ? 8000 : 5000);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt] || 10000;
        console.log(`[VideoFromImage] Retry ${attempt}/${MAX_RETRIES - 1}, waiting ${delay / 1000}s...`);
        await wait(delay);
      }

      try {
        const response = await axios.get(currentUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgencyBot/1.0)' },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        // Verify we got actual image data (not an error page)
        if (response.data.length < 5000) {
          throw new Error(`Response too small (${response.data.length} bytes) — likely not an image`);
        }

        fs.writeFileSync(tmpFile, response.data);
        console.log(`[VideoFromImage] Image downloaded successfully (${(response.data.length / 1024).toFixed(0)}KB)`);
        return tmpFile;
      } catch (err: any) {
        const status = err.response?.status || 'network';
        console.log(`[VideoFromImage] Download attempt ${attempt + 1} failed: ${status} — ${err.message}`);

        // If server error (5xx), skip remaining retries for this URL — try next provider
        if (err.response?.status >= 500 && attempt >= 1) {
          console.log(`[VideoFromImage] Server error — skipping to next provider`);
          break;
        }
      }
    }
  }

  throw new Error(`Failed to download image from all providers after retries`);
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
