/**
 * Video From Text Service v2 — Premium Animated Text Videos
 *
 * Generates vertical (9:16) videos optimized for Reels/TikTok/Shorts:
 * - 5 slides from post structure (Hook → Context → Value → Proof → CTA)
 * - Animated progress bar at bottom
 * - Topic header at top
 * - Larger fonts, better spacing, fade transitions
 * - Premium dark backgrounds with accent colors
 *
 * No external API needed — 100% local, zero tokens, zero internet.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VideoFormat } from './content-atomizer.service';

ffmpeg.setFfmpegPath(ffmpegStatic as string);

// Vertical 9:16 for Reels/TikTok/Shorts
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const FPS = 30;
const SLIDE_DURATION = 4; // 4s per slide (was 3)
const TOTAL_SLIDES = 3;
const TOTAL_DURATION = SLIDE_DURATION * TOTAL_SLIDES; // 12 seconds

// Premium color schemes — rotate for variety
const COLOR_SCHEMES = [
  { bg: '0a0a0a', text: 'ffffff', accent: 'f5a623', name: 'gold' },
  { bg: '0d1117', text: 'e6edf3', accent: '58a6ff', name: 'ocean' },
  { bg: '1a0a2e', text: 'ffffff', accent: 'a855f7', name: 'purple' },
  { bg: '0f172a', text: 'f1f5f9', accent: '38bdf8', name: 'sky' },
  { bg: '1c1917', text: 'fafaf9', accent: 'f97316', name: 'fire' },
  { bg: '0a1628', text: 'ffffff', accent: '22d3ee', name: 'cyan' },
  { bg: '14120e', text: 'fef3c7', accent: 'fbbf24', name: 'amber' },
  { bg: '0e0e10', text: 'ffffff', accent: 'ef4444', name: 'red' },
  { bg: '0c1220', text: 'ffffff', accent: '10b981', name: 'emerald' },
  { bg: '1a0e0e', text: 'fecaca', accent: 'f43f5e', name: 'rose' },
];

let schemeIndex = 0;

function getNextScheme() {
  const scheme = COLOR_SCHEMES[schemeIndex % COLOR_SCHEMES.length];
  schemeIndex++;
  return scheme;
}

/**
 * Word-wrap text for video slides.
 * Shorter lines = bigger visual impact on vertical video.
 */
function wrapText(text: string, maxCharsPerLine: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  return lines.join('\n');
}

/**
 * Escape text for ffmpeg drawtext filter
 */
function escapeForDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}

/**
 * Get font path for the current platform
 */
function getFontArg(): string {
  const fontCandidates = [
    { check: 'C:\\Windows\\Fonts\\arialbd.ttf', ffmpeg: 'C\\\\:/Windows/Fonts/arialbd.ttf' },
    { check: 'C:\\Windows\\Fonts\\arial.ttf', ffmpeg: 'C\\\\:/Windows/Fonts/arial.ttf' },
    { check: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', ffmpeg: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
    { check: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', ffmpeg: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' },
  ];

  for (const f of fontCandidates) {
    if (fs.existsSync(f.check)) {
      return `fontfile=${f.ffmpeg}:`;
    }
  }
  return '';
}

export interface TextVideoSlides {
  hook: string;
  value: string;
  cta: string;
}

/**
 * Generate premium vertical video with animated text.
 *
 * Layout per slide (vertical 1080x1920):
 * - Top: Topic label (small, accent color)
 * - Center: Main text (large, white, centered)
 * - Bottom: Slide indicator dots + progress bar
 *
 * Accepts either raw message or pre-built VideoFormat slides.
 */
export async function generateTextVideo(
  message: string,
  topic: string,
  customSlides?: TextVideoSlides
): Promise<{ videoPath: string; slides: TextVideoSlides }> {
  const slides = customSlides || extractSlides(message, topic);
  const scheme = getNextScheme();
  const videoPath = path.join(os.tmpdir(), `agency_textvideo_${Date.now()}.mp4`);
  const fontArg = getFontArg();

  // Wrap text — shorter lines for vertical video (20 chars max)
  const hookWrapped = wrapText(slides.hook, 20);
  const valueWrapped = wrapText(slides.value, 22);
  const ctaWrapped = wrapText(slides.cta, 22);

  // Adaptive font sizes based on text length
  const hookFS = hookWrapped.length > 80 ? 54 : hookWrapped.length > 50 ? 60 : 68;
  const valueFS = valueWrapped.length > 100 ? 44 : valueWrapped.length > 60 ? 50 : 56;
  const ctaFS = ctaWrapped.length > 80 ? 44 : ctaWrapped.length > 50 ? 52 : 58;

  // Escape for drawtext
  const hookEsc = escapeForDrawtext(hookWrapped);
  const valueEsc = escapeForDrawtext(valueWrapped);
  const ctaEsc = escapeForDrawtext(ctaWrapped);
  const topicEsc = escapeForDrawtext(topic.substring(0, 40).toUpperCase());

  // Slide timing
  const s1End = SLIDE_DURATION;
  const s2Start = SLIDE_DURATION;
  const s2End = SLIDE_DURATION * 2;
  const s3Start = SLIDE_DURATION * 2;
  const fade = 0.6;

  // Build filter chain
  const filters = [
    // ─── TOPIC HEADER (always visible, top of screen) ───
    `drawtext=${fontArg}text='${topicEsc}':fontcolor=0x${scheme.accent}:fontsize=28:x=(w-text_w)/2:y=120:alpha=0.7`,

    // ─── SLIDE 1: Hook ───
    // Main text — centered vertically
    `drawtext=${fontArg}text='${hookEsc}':fontcolor=0x${scheme.text}:fontsize=${hookFS}:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t\\,${fade})\\,t/${fade}\\,if(gt(t\\,${s1End - fade})\\,if(lt(t\\,${s1End})\\,(${s1End}-t)/${fade}\\,0)\\,1))'`,

    // Accent bar under hook
    `drawtext=${fontArg}text='________':fontcolor=0x${scheme.accent}:fontsize=40:x=(w-text_w)/2:y=(h/2)+180:alpha='if(lt(t\\,${fade + 0.3})\\,0\\,if(lt(t\\,${fade + 0.8})\\,(t-${fade + 0.3})/0.5\\,if(gt(t\\,${s1End - fade})\\,if(lt(t\\,${s1End})\\,(${s1End}-t)/${fade}\\,0)\\,1)))'`,

    // Slide indicator: [*] [ ] [ ]
    `drawtext=${fontArg}text='o   .   .':fontcolor=0x${scheme.accent}:fontsize=32:x=(w-text_w)/2:y=h-200:alpha='if(lt(t\\,${s1End})\\,1\\,0)'`,

    // ─── SLIDE 2: Value ───
    `drawtext=${fontArg}text='${valueEsc}':fontcolor=0x${scheme.text}:fontsize=${valueFS}:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t\\,${s2Start})\\,0\\,if(lt(t\\,${s2Start + fade})\\,(t-${s2Start})/${fade}\\,if(gt(t\\,${s2End - fade})\\,if(lt(t\\,${s2End})\\,(${s2End}-t)/${fade}\\,0)\\,1)))'`,

    // Slide indicator: [ ] [*] [ ]
    `drawtext=${fontArg}text='.   o   .':fontcolor=0x${scheme.accent}:fontsize=32:x=(w-text_w)/2:y=h-200:alpha='if(lt(t\\,${s2Start})\\,0\\,if(lt(t\\,${s2End})\\,1\\,0))'`,

    // ─── SLIDE 3: CTA ───
    `drawtext=${fontArg}text='${ctaEsc}':fontcolor=0x${scheme.accent}:fontsize=${ctaFS}:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t\\,${s3Start})\\,0\\,if(lt(t\\,${s3Start + fade})\\,(t-${s3Start})/${fade}\\,1))'`,

    // Slide indicator: [ ] [ ] [*]
    `drawtext=${fontArg}text='.   .   o':fontcolor=0x${scheme.accent}:fontsize=32:x=(w-text_w)/2:y=h-200:alpha='if(lt(t\\,${s3Start})\\,0\\,1)'`,

    // ─── PROGRESS BAR (bottom, fills over total duration) ───
    `drawbox=x=0:y=h-8:w=w*(t/${TOTAL_DURATION}):h=8:color=0x${scheme.accent}@0.9:t=fill`,
  ];

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=0x${scheme.bg}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=${TOTAL_DURATION}:r=${FPS}`)
      .inputFormat('lavfi')
      .videoFilter(filters)
      .outputOptions([
        '-c:v', 'libx264',
        '-t', String(TOTAL_DURATION),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-preset', 'fast',
        '-crf', '23',
      ])
      .output(videoPath)
      .on('end', () => {
        try {
          const stats = fs.statSync(videoPath);
          if (stats.size < 5000) {
            reject(new Error(`Video too small: ${stats.size} bytes`));
            return;
          }
          resolve({ videoPath, slides });
        } catch (e) { reject(e); }
      })
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

/**
 * Generate video from pre-built VideoFormat slides (from atomizer).
 * Skips text extraction — uses slides directly.
 */
export async function generateTextVideoFromSlides(
  videoSlides: VideoFormat,
  topic: string
): Promise<{ videoPath: string; slides: TextVideoSlides }> {
  return generateTextVideo('', topic, {
    hook: videoSlides.hook,
    value: videoSlides.value,
    cta: videoSlides.cta,
  });
}

/**
 * Generate text video and upload to Cloudinary.
 * Returns the Cloudinary URL ready for Facebook publishing.
 */
export async function generateAndUploadTextVideo(
  message: string,
  topic: string
): Promise<string> {
  const { videoPath } = await generateTextVideo(message, topic);

  try {
    const { uploadVideoFromUrl } = await import('../config/cloudinary');
    const uploaded = await uploadVideoFromUrl(videoPath, 'agency-videos');
    return uploaded.url;
  } finally {
    try { fs.unlinkSync(videoPath); } catch {}
  }
}

/**
 * Extract 3 slides from raw post text (fallback when no structure provided)
 */
function extractSlides(message: string, topic: string): TextVideoSlides {
  const parts = message.split(/\n\n+|\n/).map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length >= 3) {
    const hook = parts[0].length > 120 ? parts[0].substring(0, 117) + '...' : parts[0];
    const value = parts[Math.floor(parts.length / 2)];
    const valueTrimmed = value.length > 150 ? value.substring(0, 147) + '...' : value;
    const cta = parts[parts.length - 1].length > 100 ? parts[parts.length - 1].substring(0, 97) + '...' : parts[parts.length - 1];
    return { hook, value: valueTrimmed, cta };
  }

  if (parts.length === 2) {
    return {
      hook: parts[0].length > 120 ? parts[0].substring(0, 117) + '...' : parts[0],
      value: parts[1].length > 150 ? parts[1].substring(0, 147) + '...' : parts[1],
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
