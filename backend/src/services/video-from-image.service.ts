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

// Ken Burns effects — each creates a different zoom/pan animation
const EFFECTS = [
  // Slow zoom in from center
  `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Slow zoom out
  `zoompan=z='if(eq(on,1),1.3,max(zoom-0.001,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Pan left to right with slight zoom
  `zoompan=z='min(zoom+0.0005,1.15)':x='if(eq(on,1),0,min(x+2,iw))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Pan right to left with slight zoom
  `zoompan=z='min(zoom+0.0005,1.15)':x='if(eq(on,1),iw/4,max(x-2,0))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Zoom into top-left corner
  `zoompan=z='min(zoom+0.0015,1.5)':x='0':y='0':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Zoom into bottom-right corner
  `zoompan=z='min(zoom+0.0015,1.5)':x='iw-(iw/zoom)':y='ih-(ih/zoom)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
];

let effectIndex = 0;

function getNextEffect(): string {
  const effect = EFFECTS[effectIndex % EFFECTS.length];
  effectIndex++;
  return effect;
}

/**
 * Download image from URL to temp file
 */
async function downloadImage(url: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `agency_img_${Date.now()}.jpg`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  fs.writeFileSync(tmpFile, response.data);
  return tmpFile;
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
