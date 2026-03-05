/**
 * Premium Video Service v3 — Cinematic Ken Burns + Text + Music
 *
 * Pipeline: Image → Ken Burns motion → gradient overlay → text → ambient music → MP4
 *
 * Uses the established cinematic effects library (Spielberg, Nolan, Apple, etc.)
 * with vertical 1080x1920 format optimized for Reels/TikTok/Shorts.
 *
 * Music: procedurally generated ambient audio matched to content category.
 * 100% royalty-free (synthesized via ffmpeg, no external files needed).
 *
 * Zero external APIs. Zero tokens. Zero internet (after image download).
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
const VIDEO_DURATION = 10; // 10 seconds — ideal for Reels

// ─── Cinematic Ken Burns Effects (vertical 1080x1920) ────────
// 10 premium effects inspired by documentary/commercial filmmaking
const EFFECTS = [
  // Spielberg reveal — dramatic slow zoom in, builds tension
  `zoompan=z='min(zoom+0.0008,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Nolan wide reveal — elegant zoom out, reveals context
  `zoompan=z='if(eq(on,1),1.3,max(zoom-0.0008,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Documentary tracking — smooth pan left to right
  `zoompan=z='min(zoom+0.0004,1.12)':x='if(eq(on,1),0,min(x+1.5,iw))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Editorial panning — smooth pan right to left
  `zoompan=z='min(zoom+0.0004,1.12)':x='if(eq(on,1),iw/4,max(x-1.5,0))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Macro documentary — intimate top focus zoom
  `zoompan=z='min(zoom+0.001,1.4)':x='iw/4':y='0':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Editorial bottom reveal — unexpected focal point
  `zoompan=z='min(zoom+0.001,1.4)':x='iw/2-(iw/zoom/2)':y='ih-(ih/zoom)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Cinematic diagonal drift — top-left to center with zoom
  `zoompan=z='min(zoom+0.0006,1.2)':x='if(eq(on,1),0,min(x+0.8,iw/2-(iw/zoom/2)))':y='if(eq(on,1),0,min(y+0.8,ih/2-(ih/zoom/2)))':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Apple aspirational — center-out zoom with upward drift
  `zoompan=z='if(eq(on,1),1.35,max(zoom-0.001,1))':x='iw/2-(iw/zoom/2)':y='if(eq(on,1),ih/2-(ih/zoom/2),max(y-0.4,0))':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Red Bull intensity — slow push into center-right
  `zoompan=z='min(zoom+0.0009,1.3)':x='if(eq(on,1),iw/3,min(x+0.4,iw/2-(iw/zoom/2)))':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
  // Luxury brand — zoom out from golden ratio point
  `zoompan=z='if(eq(on,1),1.45,max(zoom-0.0012,1))':x='iw*0.618-(iw/zoom/2)':y='ih*0.382-(ih/zoom/2)':d=${VIDEO_DURATION * VIDEO_FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
];

let effectIndex = 0;
function getNextEffect(): string {
  const effect = EFFECTS[effectIndex % EFFECTS.length];
  effectIndex++;
  return effect;
}

// ─── Music Moods by Category ─────────────────────────────────
// Each mood defines sine wave frequencies that create an ambient chord
// plus tempo (volume modulation speed) to match energy level.
// 100% royalty-free — procedurally generated, unique every time.

interface MusicMood {
  name: string;
  // Frequencies in Hz for sine wave chord (2-4 notes)
  freqs: number[];
  // Volume levels per note (0-1)
  volumes: number[];
  // BPM-like pulse speed (lower = calmer)
  pulseHz: number;
  // Master volume
  master: number;
}

const MUSIC_MOODS: Record<string, MusicMood> = {
  // Calm ambient — C major pad (C3 + E3 + G3)
  educativo: {
    name: 'calm-ambient',
    freqs: [130.81, 164.81, 196.00],
    volumes: [0.3, 0.2, 0.15],
    pulseHz: 0.25,
    master: 0.12,
  },
  // Uplifting — G major (G3 + B3 + D4)
  motivacional: {
    name: 'uplifting',
    freqs: [196.00, 246.94, 293.66],
    volumes: [0.3, 0.25, 0.2],
    pulseHz: 0.5,
    master: 0.13,
  },
  // Confident deep — C power chord (C2 + G2 + C3)
  autoridade: {
    name: 'confident-deep',
    freqs: [65.41, 98.00, 130.81],
    volumes: [0.35, 0.25, 0.15],
    pulseHz: 0.3,
    master: 0.11,
  },
  // Energetic — A minor driving (A3 + C4 + E4)
  engajamento: {
    name: 'energetic',
    freqs: [220.00, 261.63, 329.63],
    volumes: [0.25, 0.25, 0.2],
    pulseHz: 0.8,
    master: 0.13,
  },
  // Dramatic tension — diminished (B2 + D3 + F3)
  provocativo: {
    name: 'dramatic',
    freqs: [123.47, 146.83, 174.61],
    volumes: [0.3, 0.25, 0.25],
    pulseHz: 0.4,
    master: 0.12,
  },
  // Light friendly — F major (F3 + A3 + C4)
  dica_pratica: {
    name: 'light-friendly',
    freqs: [174.61, 220.00, 261.63],
    volumes: [0.25, 0.2, 0.2],
    pulseHz: 0.6,
    master: 0.12,
  },
};

// Default mood for unknown categories
const DEFAULT_MOOD: MusicMood = MUSIC_MOODS.educativo;

/**
 * Build ffmpeg audio filter for ambient music synthesis.
 * Creates a warm chord from sine waves with gentle volume pulsing + fade in/out.
 */
function buildMusicFilter(category: string): string {
  const mood = MUSIC_MOODS[category] || DEFAULT_MOOD;

  // Build sine wave generators for each note in the chord
  const sines = mood.freqs
    .map((freq, i) => {
      const vol = mood.volumes[i] || 0.2;
      // Each sine gets subtle pulse modulation for organic feel
      // sin(2*PI*pulseHz*t) creates gentle volume breathing
      return `sin(${freq}*2*PI*t)*${vol}*(0.7+0.3*sin(${mood.pulseHz}*2*PI*t+${i * 1.5}))`;
    })
    .join('+');

  // Combine: chord mix * master volume * fade envelope
  // Fade: 2s in, 2s out
  const fadeIn = `min(t/2,1)`;
  const fadeOut = `min((${VIDEO_DURATION}-t)/2,1)`;

  return `aevalsrc='(${sines})*${mood.master}*${fadeIn}*${fadeOut}':s=44100:d=${VIDEO_DURATION}`;
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

// ─── Public Types ────────────────────────────────────────────

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
}

// ─── Main Video Generator ────────────────────────────────────

/**
 * Generate premium cinematic video:
 * Image → Ken Burns cinematic motion → gradient overlay → text + shadow → ambient music
 *
 * ALWAYS requires an image. The video-generator agent is responsible for
 * generating an AI image (via Pollinations) when none exists.
 * If imageUrl is not provided here, uses Picsum as emergency fallback.
 *
 * @param message Post message text
 * @param topic Post topic
 * @param category Content category (for music mood matching)
 * @param imageUrl Image URL for Ken Burns background (REQUIRED for quality)
 */
export async function generatePremiumVideo(
  message: string,
  topic: string,
  category: string = 'educativo',
  imageUrl?: string
): Promise<VideoResult> {
  const slides = extractSlides(message, topic);
  const effect = getNextEffect();
  const mood = MUSIC_MOODS[category] || DEFAULT_MOOD;
  const videoPath = path.join(os.tmpdir(), `agency_premium_${Date.now()}.mp4`);
  const font = getFontPath();

  // ALWAYS need an image — emergency fallback to Picsum if none provided
  const finalImageUrl = imageUrl || `https://picsum.photos/seed/${Date.now()}/1080/1920`;
  const bgImagePath = await downloadImageToTemp(finalImageUrl);

  if (!bgImagePath) {
    throw new Error('Failed to download background image for video');
  }

  const hookText = escapeDrawtext(wrapText(truncate(slides.hook, 100), 18));
  const topicText = escapeDrawtext(truncate(topic, 35).toUpperCase());
  const ctaText = escapeDrawtext(wrapText(truncate(slides.cta, 80), 20));

  // Font sizes — adaptive
  const hookLen = hookText.length;
  const hookFS = hookLen > 80 ? 48 : hookLen > 50 ? 56 : 64;
  const ctaFS = ctaText.length > 60 ? 38 : 44;

  // Font arg for drawtext
  const fontArg = font ? `fontfile=${font.ffmpeg}:` : '';

  // Build music filter
  const musicFilter = buildMusicFilter(category);

  return new Promise((resolve, reject) => {
    ffmpeg()
      // Input 0: Background image (looped for video duration)
      .input(bgImagePath)
      .inputOptions(['-loop', '1', '-t', String(VIDEO_DURATION)])
      // Input 1: Procedural ambient music
      .input(musicFilter)
      .inputOptions(['-f', 'lavfi'])
      .complexFilter([
        // [0] Image → Ken Burns cinematic motion (zoom/pan)
        `[0:v]${effect}[motion]`,
        // Darken image for text readability (keep visual richness)
        `[motion]colorlevels=rimax=0.55:gimax=0.55:bimax=0.55[dark]`,
        // Topic label — small, top center
        `[dark]drawtext=${fontArg}text='${topicText}':fontcolor=0xffffff:fontsize=26:x=(w-text_w)/2:y=160:alpha=0.6[t1]`,
        // Hook text shadow — offset 3px for depth
        `[t1]drawtext=${fontArg}text='${hookText}':fontcolor=0x000000:fontsize=${hookFS}:x=(w-text_w)/2+3:y=(h*0.38)-text_h/2+3:alpha='if(lt(t\\,1)\\,t*0.4\\,0.4)'[shadow]`,
        // Hook text — large, white, centered, fade in 1s
        `[shadow]drawtext=${fontArg}text='${hookText}':fontcolor=0xffffff:fontsize=${hookFS}:x=(w-text_w)/2:y=(h*0.38)-text_h/2:alpha='if(lt(t\\,1)\\,t\\,1)'[t2]`,
        // CTA — bottom area, fade in after 5s
        `[t2]drawtext=${fontArg}text='${ctaText}':fontcolor=0xffffff:fontsize=${ctaFS}:x=(w-text_w)/2:y=h*0.78:alpha='if(lt(t\\,5)\\,0\\,if(lt(t\\,6)\\,t-5\\,1))'[vout]`,
        // Audio: low-pass for warmth
        `[1:a]lowpass=f=3000,volume=1[aout]`,
      ], ['vout', 'aout'])
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-t', String(VIDEO_DURATION),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-preset', 'fast',
        '-crf', '23',
        '-shortest',
      ])
      .output(videoPath)
      .on('end', () => {
        try { fs.unlinkSync(bgImagePath); } catch {}
        try {
          const size = fs.statSync(videoPath).size;
          if (size < 5000) { reject(new Error(`Video too small: ${size} bytes`)); return; }
          resolve({ videoPath, slides, effect: 'ken-burns', musicMood: mood.name, hasImage: true });
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

// ─── Text Extraction ─────────────────────────────────────────

function extractSlides(message: string, topic: string): TextVideoSlides {
  const parts = message.split(/\n\n+|\n/).map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length >= 3) {
    return {
      hook: parts[0].length > 120 ? parts[0].substring(0, 117) + '...' : parts[0],
      value: parts[Math.floor(parts.length / 2)].substring(0, 150),
      cta: parts[parts.length - 1].substring(0, 100),
    };
  }

  if (parts.length === 2) {
    return {
      hook: parts[0].substring(0, 120),
      value: parts[1].substring(0, 150),
      cta: 'Salva e compartilha!',
    };
  }

  const sentences = message.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  return {
    hook: (sentences[0] || topic).substring(0, 120),
    value: (sentences[1] || sentences[0] || topic).substring(0, 150),
    cta: sentences.length > 2 ? sentences[sentences.length - 1].substring(0, 100) : 'O que voce acha? Comenta ai!',
  };
}
