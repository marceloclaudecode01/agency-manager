/**
 * Premium Video Service v4 — Multi-Slide Storytelling
 *
 * Pipeline: Post message → 4 slides (hook, context, value, CTA)
 *           → 1 AI image with varied Ken Burns per slide
 *           → Semi-transparent text backgrounds for readability
 *           → Crossfade transitions between slides
 *           → Ambient music → MP4 1080x1920 vertical (~15s)
 *
 * Uses generateImageForPost() for AI-relevant images (no more Picsum randoms).
 * Music: procedurally generated ambient audio matched to content category.
 * 100% royalty-free (synthesized via ffmpeg, no external files needed).
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Fix Windows paths with spaces (fluent-ffmpeg uses spawn without shell)
const rawFfmpegPath = ffmpegStatic as string;
let resolvedFfmpegPath = rawFfmpegPath;
if (process.platform === 'win32' && rawFfmpegPath.includes(' ')) {
  const tempFfmpeg = path.join(os.tmpdir(), 'ffmpeg_agency.exe');
  if (!fs.existsSync(tempFfmpeg)) {
    try { fs.copyFileSync(rawFfmpegPath, tempFfmpeg); } catch { /* use original */ }
  }
  if (fs.existsSync(tempFfmpeg)) resolvedFfmpegPath = tempFfmpeg;
}
ffmpeg.setFfmpegPath(resolvedFfmpegPath);

// ─── Video Config ────────────────────────────────────────────
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS = 30;

// Multi-slide timing
const SLIDE_DURATION = 3.5; // seconds per slide
const CROSSFADE = 0.5;      // crossfade overlap between slides
const SLIDE_COUNT = 4;
// Total: 4 slides * 3.5s - 3 crossfades * 0.5s = 12.5s + fade in/out ≈ 15s
const VIDEO_DURATION = SLIDE_COUNT * SLIDE_DURATION - (SLIDE_COUNT - 1) * CROSSFADE;

// ─── Cinematic Ken Burns Effects (per-slide variations) ──────
// Each slide uses a different Ken Burns effect for visual variety from a single image
// Duration param is per-slide (SLIDE_DURATION * FPS frames)
const SLIDE_FRAMES = Math.round(SLIDE_DURATION * VIDEO_FPS);

function buildSlideEffects(): string[] {
  return [
    // Slide 1 (HOOK): Spielberg reveal — dramatic slow zoom in
    `zoompan=z='min(zoom+0.0015,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${SLIDE_FRAMES}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
    // Slide 2 (CONTEXT): Documentary tracking — smooth pan left to right
    `zoompan=z='min(zoom+0.0006,1.12)':x='if(eq(on,1),0,min(x+2.5,iw))':y='ih/2-(ih/zoom/2)':d=${SLIDE_FRAMES}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
    // Slide 3 (VALUE): Apple aspirational — center-out zoom with upward drift
    `zoompan=z='if(eq(on,1),1.35,max(zoom-0.0015,1))':x='iw/2-(iw/zoom/2)':y='if(eq(on,1),ih/2-(ih/zoom/2),max(y-0.6,0))':d=${SLIDE_FRAMES}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
    // Slide 4 (CTA): Nolan wide reveal — elegant zoom out
    `zoompan=z='if(eq(on,1),1.3,max(zoom-0.0012,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${SLIDE_FRAMES}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  ];
}

// Full-video effects for legacy/Video Intelligence usage
const EFFECTS = [
  `zoompan=z='min(zoom+0.0008,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='if(eq(on,1),1.3,max(zoom-0.0008,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='min(zoom+0.0004,1.12)':x='if(eq(on,1),0,min(x+1.5,iw))':y='ih/2-(ih/zoom/2)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='min(zoom+0.0004,1.12)':x='if(eq(on,1),iw/4,max(x-1.5,0))':y='ih/2-(ih/zoom/2)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='min(zoom+0.001,1.4)':x='iw/4':y='0':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='min(zoom+0.001,1.4)':x='iw/2-(iw/zoom/2)':y='ih-(ih/zoom)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='min(zoom+0.0006,1.2)':x='if(eq(on,1),0,min(x+0.8,iw/2-(iw/zoom/2)))':y='if(eq(on,1),0,min(y+0.8,ih/2-(ih/zoom/2)))':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='if(eq(on,1),1.35,max(zoom-0.001,1))':x='iw/2-(iw/zoom/2)':y='if(eq(on,1),ih/2-(ih/zoom/2),max(y-0.4,0))':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='min(zoom+0.0009,1.3)':x='if(eq(on,1),iw/3,min(x+0.4,iw/2-(iw/zoom/2)))':y='ih/2-(ih/zoom/2)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  `zoompan=z='if(eq(on,1),1.45,max(zoom-0.0012,1))':x='iw*0.618-(iw/zoom/2)':y='ih*0.382-(ih/zoom/2)':d=${Math.round(VIDEO_DURATION * VIDEO_FPS)}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
];

let effectIndex = 0;
function getNextEffect(): { effect: string; index: number } {
  const idx = effectIndex % EFFECTS.length;
  effectIndex++;
  return { effect: EFFECTS[idx], index: idx };
}

/** Get effect by specific index (used by Video Intelligence) */
export function getEffectByIndex(index: number): string {
  return EFFECTS[index % EFFECTS.length];
}

/** Total number of effects available */
export const EFFECT_COUNT = EFFECTS.length;

// ─── Music Moods by Category ─────────────────────────────────

interface MusicMood {
  name: string;
  freqs: number[];
  volumes: number[];
  pulseHz: number;
  master: number;
}

const MUSIC_MOODS: Record<string, MusicMood> = {
  educativo: {
    name: 'calm-ambient',
    freqs: [130.81, 164.81, 196.00],
    volumes: [0.3, 0.2, 0.15],
    pulseHz: 0.25,
    master: 0.12,
  },
  motivacional: {
    name: 'uplifting',
    freqs: [196.00, 246.94, 293.66],
    volumes: [0.3, 0.25, 0.2],
    pulseHz: 0.5,
    master: 0.13,
  },
  autoridade: {
    name: 'confident-deep',
    freqs: [65.41, 98.00, 130.81],
    volumes: [0.35, 0.25, 0.15],
    pulseHz: 0.3,
    master: 0.11,
  },
  engajamento: {
    name: 'energetic',
    freqs: [220.00, 261.63, 329.63],
    volumes: [0.25, 0.25, 0.2],
    pulseHz: 0.8,
    master: 0.13,
  },
  provocativo: {
    name: 'dramatic',
    freqs: [123.47, 146.83, 174.61],
    volumes: [0.3, 0.25, 0.25],
    pulseHz: 0.4,
    master: 0.12,
  },
  dica_pratica: {
    name: 'light-friendly',
    freqs: [174.61, 220.00, 261.63],
    volumes: [0.25, 0.2, 0.2],
    pulseHz: 0.6,
    master: 0.12,
  },
};

const DEFAULT_MOOD: MusicMood = MUSIC_MOODS.educativo;

function buildMusicFilter(category: string, duration: number): string {
  const mood = MUSIC_MOODS[category] || DEFAULT_MOOD;

  const sines = mood.freqs
    .map((freq, i) => {
      const vol = mood.volumes[i] || 0.2;
      return `sin(${freq}*2*PI*t)*${vol}*(0.7+0.3*sin(${mood.pulseHz}*2*PI*t+${i * 1.5}))`;
    })
    .join('+');

  const fadeIn = `min(t/2,1)`;
  const fadeOut = `min((${duration}-t)/2,1)`;

  return `aevalsrc='(${sines})*${mood.master}*${fadeIn}*${fadeOut}':s=44100:d=${duration}`;
}

// ─── Font Detection ──────────────────────────────────────────

function getFontPath(): { check: string; ffmpeg: string } | null {
  const candidates = [
    { check: 'C:/Windows/Fonts/arialbd.ttf', ffmpeg: 'C\\\\:/Windows/Fonts/arialbd.ttf' },
    { check: 'C:/Windows/Fonts/arial.ttf', ffmpeg: 'C\\\\:/Windows/Fonts/arial.ttf' },
    { check: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', ffmpeg: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
    { check: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', ffmpeg: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' },
  ];
  for (const f of candidates) {
    if (fs.existsSync(f.check)) return f;
  }
  return null;
}

// ─── Text Helpers ────────────────────────────────────────────

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}

function wrapText(text: string, maxChars: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line.trim());
  return lines.join('\n');
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text || '';
  const cut = text.substring(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.substring(0, space) : cut) + '...';
}

// ─── Image Download ──────────────────────────────────────────

async function downloadImageToTemp(url: string): Promise<string | null> {
  try {
    const http = url.startsWith('https') ? await import('https') : await import('http');
    const ext = url.includes('.png') ? '.png' : '.jpg';
    const tmpPath = path.join(os.tmpdir(), `agency_vbg_${Date.now()}${ext}`);

    return new Promise((resolve) => {
      const req = http.get(url, { timeout: 15000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadImageToTemp(res.headers.location).then(resolve);
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) { resolve(null); return; }
        const ws = fs.createWriteStream(tmpPath);
        res.pipe(ws);
        ws.on('finish', () => {
          ws.close();
          try {
            if (fs.statSync(tmpPath).size < 1024) { fs.unlinkSync(tmpPath); resolve(null); return; }
            resolve(tmpPath);
          } catch { resolve(null); }
        });
        ws.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch { return null; }
}

// ─── AI Image Generation (replaces Picsum) ───────────────────

async function getOrGenerateImage(
  imageUrl: string | undefined,
  topic: string,
  category: string,
  message: string
): Promise<string | null> {
  // If caller provided an image URL, use it directly
  if (imageUrl) {
    return downloadImageToTemp(imageUrl);
  }

  // Generate AI image via Pollinations (image-generator agent)
  try {
    const { generateImageForPost } = await import('../agents/image-generator.agent');
    console.log('[video-v4] Generating AI image for video...');
    const generated = await generateImageForPost(topic, category, message);
    if (generated?.url) {
      const imgPath = await downloadImageToTemp(generated.url);
      if (imgPath) return imgPath;
      console.warn('[video-v4] AI image download failed, falling back to Picsum');
    } else {
      console.warn('[video-v4] AI image generation returned no URL, falling back to Picsum');
    }
  } catch (err: any) {
    console.warn('[video-v4] AI image generation failed, falling back to Picsum:', err?.message || err);
  }

  // Emergency fallback — Picsum
  console.log('[video-v4] Using Picsum fallback image...');
  const picsum = await downloadImageToTemp(`https://picsum.photos/seed/${Date.now()}/1080/1920`);
  if (picsum) return picsum;

  // Last resort — generate a solid color image with ffmpeg
  console.warn('[video-v4] Picsum also failed, generating solid background...');
  const solidPath = path.join(os.tmpdir(), `agency_solid_${Date.now()}.png`);
  return new Promise((resolve) => {
    const { execSync } = require('child_process');
    try {
      execSync(`"${resolvedFfmpegPath}" -f lavfi -i "color=c=0x1a1a2e:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1" -frames:v 1 "${solidPath}" -y`, { timeout: 10000 });
      if (fs.existsSync(solidPath) && fs.statSync(solidPath).size > 100) {
        resolve(solidPath);
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}

// ─── Public Types ────────────────────────────────────────────

export interface SlideContent {
  label: string;  // HOOK, CONTEXT, VALUE, CTA
  text: string;
}

export interface TextVideoSlides {
  hook: string;
  value: string;
  cta: string;
}

export interface VideoResult {
  videoPath: string;
  slides: TextVideoSlides;
  effect: string;
  musicMood: string;
  hasImage: boolean;
  effectIndex?: number;
  slideCount: number;
  duration: number;
}

// ─── Slide Extraction ─────────────────────────────────────────

function extractSlides(message: string, topic: string): SlideContent[] {
  const parts = message.split(/\n\n+|\n/).map(p => p.trim()).filter(p => p.length > 0);

  // Remove hashtag lines from content
  const contentParts = parts.filter(p => !p.startsWith('#') || p.length > 60);

  if (contentParts.length >= 4) {
    return [
      { label: 'HOOK', text: truncate(contentParts[0], 90) },
      { label: 'CONTEXT', text: truncate(contentParts[1], 100) },
      { label: 'VALUE', text: truncate(contentParts[Math.floor(contentParts.length / 2)], 100) },
      { label: 'CTA', text: truncate(contentParts[contentParts.length - 1], 80) },
    ];
  }

  if (contentParts.length === 3) {
    return [
      { label: 'HOOK', text: truncate(contentParts[0], 90) },
      { label: 'CONTEXT', text: truncate(contentParts[1], 100) },
      { label: 'VALUE', text: truncate(contentParts[1], 100) },
      { label: 'CTA', text: truncate(contentParts[2], 80) },
    ];
  }

  if (contentParts.length === 2) {
    return [
      { label: 'HOOK', text: truncate(contentParts[0], 90) },
      { label: 'CONTEXT', text: truncate(contentParts[0], 100) },
      { label: 'VALUE', text: truncate(contentParts[1], 100) },
      { label: 'CTA', text: 'Salva e compartilha!' },
    ];
  }

  // Single paragraph — split by sentences
  const sentences = message.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  return [
    { label: 'HOOK', text: truncate(sentences[0] || topic, 90) },
    { label: 'CONTEXT', text: truncate(sentences[1] || sentences[0] || topic, 100) },
    { label: 'VALUE', text: truncate(sentences[2] || sentences[1] || topic, 100) },
    { label: 'CTA', text: sentences.length > 3 ? truncate(sentences[sentences.length - 1], 80) : 'O que voce acha? Comenta ai!' },
  ];
}

/** Convert new SlideContent[] to legacy TextVideoSlides for backward compat */
function slidesToLegacy(slides: SlideContent[]): TextVideoSlides {
  return {
    hook: slides[0]?.text || '',
    value: slides[2]?.text || '',
    cta: slides[3]?.text || '',
  };
}

// ─── Multi-Slide Video Builder ───────────────────────────────

/**
 * Build ffmpeg complexFilter for multi-slide video:
 * - 4 streams from same image, each with different Ken Burns
 * - Semi-transparent dark box behind text for readability
 * - Crossfade transitions between slides
 * - Fade in on first slide, fade out on last
 */
function buildMultiSlideFilter(
  slides: SlideContent[],
  fontArg: string,
): string[] {
  const slideEffects = buildSlideEffects();
  const filters: string[] = [];

  // Generate 4 slide streams from the single input image
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const slide = slides[i];
    const effect = slideEffects[i];
    const escapedText = escapeDrawtext(wrapText(truncate(slide.text, 90), 18));
    const labelText = escapeDrawtext(slide.label);

    // Text sizing — hook and CTA get larger text
    const isEmphasis = i === 0 || i === SLIDE_COUNT - 1;
    const textLen = escapedText.length;
    const fontSize = isEmphasis
      ? (textLen > 70 ? 48 : textLen > 40 ? 56 : 64)
      : (textLen > 70 ? 40 : textLen > 40 ? 46 : 52);
    const labelSize = 24;

    // Ken Burns motion on image
    filters.push(`[0:v]${effect}[motion${i}]`);

    // Darken slightly for readability
    filters.push(`[motion${i}]colorlevels=rimax=0.50:gimax=0.50:bimax=0.50[dark${i}]`);

    // Semi-transparent dark box behind text (much more readable than shadow-only)
    // Box covers middle 40% of frame height
    filters.push(
      `[dark${i}]drawbox=x=0:y=ih*0.30:w=iw:h=ih*0.42:color=black@0.50:t=fill[box${i}]`
    );

    // Label text — small, top of box area
    filters.push(
      `[box${i}]drawtext=${fontArg}text='${labelText}':fontcolor=0xffffff:fontsize=${labelSize}:x=(w-text_w)/2:y=h*0.33:alpha=0.7[lbl${i}]`
    );

    // Main text — centered in box area, with fade in
    const fadeIn = `if(lt(t\\,0.5)\\,t*2\\,1)`;
    filters.push(
      `[lbl${i}]drawtext=${fontArg}text='${escapedText}':fontcolor=0xffffff:fontsize=${fontSize}:x=(w-text_w)/2:y=(h*0.5)-text_h/2:alpha='${fadeIn}'[slide${i}]`
    );
  }

  // Crossfade chain: slide0 xfade slide1 → xfade slide2 → xfade slide3
  // xfade offset = slide_duration - crossfade_duration (in seconds from start of that segment)
  const xfadeOffset = SLIDE_DURATION - CROSSFADE;

  filters.push(
    `[slide0][slide1]xfade=transition=fade:duration=${CROSSFADE}:offset=${xfadeOffset}[xf01]`
  );
  filters.push(
    `[xf01][slide2]xfade=transition=fade:duration=${CROSSFADE}:offset=${xfadeOffset * 2 - CROSSFADE}[xf012]`
  );
  filters.push(
    `[xf012][slide3]xfade=transition=fade:duration=${CROSSFADE}:offset=${xfadeOffset * 3 - CROSSFADE * 2}[vout]`
  );

  // Audio: low-pass for warmth
  filters.push(`[1:a]lowpass=f=3000,volume=1[aout]`);

  return filters;
}

// ─── Main Video Generator ────────────────────────────────────

/**
 * Generate premium multi-slide cinematic video:
 * Post → 4 slides → AI image with varied Ken Burns → crossfade → ambient music → MP4
 *
 * Uses generateImageForPost() for AI-relevant images when no imageUrl provided.
 *
 * @param message Post message text
 * @param topic Post topic
 * @param category Content category (for music mood matching)
 * @param imageUrl Image URL for Ken Burns background
 * @param smartEffectIndex Override effect index (from Video Intelligence) — used for single-effect fallback
 */
export async function generatePremiumVideo(
  message: string,
  topic: string,
  category: string = 'educativo',
  imageUrl?: string,
  smartEffectIndex?: number
): Promise<VideoResult> {
  const slides = extractSlides(message, topic);
  const legacySlides = slidesToLegacy(slides);
  const mood = MUSIC_MOODS[category] || DEFAULT_MOOD;
  const videoPath = path.join(os.tmpdir(), `agency_premium_${Date.now()}.mp4`);
  const font = getFontPath();
  const fontArg = font ? `fontfile=${font.ffmpeg}:` : '';

  // Get or generate AI image
  const bgImagePath = await getOrGenerateImage(imageUrl, topic, category, message);

  if (!bgImagePath) {
    throw new Error('Failed to obtain background image for video');
  }

  // Build music filter with correct duration
  const musicFilter = buildMusicFilter(category, VIDEO_DURATION);

  // Build multi-slide filter chain
  const filterChain = buildMultiSlideFilter(slides, fontArg);

  return new Promise((resolve, reject) => {
    ffmpeg()
      // Input 0: Background image (looped for total video duration)
      .input(bgImagePath)
      .inputOptions(['-loop', '1', '-t', String(SLIDE_DURATION)])
      // Input 1: Procedural ambient music
      .input(musicFilter)
      .inputOptions(['-f', 'lavfi'])
      .complexFilter(filterChain, ['vout', 'aout'])
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', String(VIDEO_DURATION),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-preset', 'medium',
        '-crf', '18',
        '-shortest',
      ])
      .output(videoPath)
      .on('end', () => {
        try { fs.unlinkSync(bgImagePath); } catch {}
        try {
          const size = fs.statSync(videoPath).size;
          if (size < 5000) { reject(new Error(`Video too small: ${size} bytes`)); return; }
          const effectData = smartEffectIndex !== undefined
            ? { index: smartEffectIndex % EFFECTS.length }
            : { index: getNextEffect().index };
          resolve({
            videoPath,
            slides: legacySlides,
            effect: 'multi-slide-ken-burns',
            musicMood: mood.name,
            hasImage: true,
            effectIndex: effectData.index,
            slideCount: SLIDE_COUNT,
            duration: VIDEO_DURATION,
          });
        } catch (e) { reject(e); }
      })
      .on('error', (err: Error) => {
        try { fs.unlinkSync(bgImagePath); } catch {}
        reject(err);
      })
      .run();
  });
}

/**
 * Generate premium video and upload to Cloudinary.
 * Returns the Cloudinary URL ready for Facebook publishing.
 */
export async function generateAndUploadPremiumVideo(
  message: string,
  topic: string,
  category: string = 'educativo',
  imageUrl?: string
): Promise<string> {
  const result = await generatePremiumVideo(message, topic, category, imageUrl);
  try {
    const { uploadVideoFromUrl } = await import('../config/cloudinary');
    const uploaded = await uploadVideoFromUrl(result.videoPath, 'agency-videos');
    return uploaded.url;
  } finally {
    try { fs.unlinkSync(result.videoPath); } catch {}
  }
}

// ─── Legacy exports (backward compat) ────────────────────────

/** @deprecated Use generatePremiumVideo instead */
export async function generateTextVideo(
  message: string,
  topic: string,
  customSlides?: TextVideoSlides,
  imageUrl?: string
): Promise<{ videoPath: string; slides: TextVideoSlides }> {
  const result = await generatePremiumVideo(message, topic, 'educativo', imageUrl);
  return { videoPath: result.videoPath, slides: result.slides };
}

/** @deprecated Use generateAndUploadPremiumVideo instead */
export async function generateAndUploadTextVideo(
  message: string,
  topic: string,
  imageUrl?: string
): Promise<string> {
  return generateAndUploadPremiumVideo(message, topic, 'educativo', imageUrl);
}

/** @deprecated Use generatePremiumVideo instead */
export async function generateTextVideoFromSlides(
  videoSlides: { hook: string; value: string; cta: string },
  topic: string,
  imageUrl?: string
): Promise<{ videoPath: string; slides: TextVideoSlides }> {
  const msg = `${videoSlides.hook}\n\n${videoSlides.value}\n\n${videoSlides.cta}`;
  const result = await generatePremiumVideo(msg, topic, 'educativo', imageUrl);
  return { videoPath: result.videoPath, slides: result.slides };
}
