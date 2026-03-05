/**
 * Video From Text Service — Creates animated text videos (Reels/TikTok style)
 *
 * Generates 3-slide videos with animated text using ffmpeg drawtext:
 * Slide 1: Hook (attention-grabbing opening)
 * Slide 2: Value (main content/insight)
 * Slide 3: CTA (call to action)
 *
 * No external API needed — 100% local, zero tokens, zero internet.
 * Style: dark premium backgrounds with bold white text, like viral Reels.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

ffmpeg.setFfmpegPath(ffmpegStatic as string);

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1080;
const FPS = 30;
const SLIDE_DURATION = 3; // seconds per slide
const TOTAL_DURATION = SLIDE_DURATION * 3; // 9 seconds total

// Premium color schemes — rotate for variety
const COLOR_SCHEMES = [
  { bg: '0a0a0a', text: 'ffffff', accent: 'f5a623' }, // Dark + white + gold
  { bg: '0d1117', text: 'e6edf3', accent: '58a6ff' }, // GitHub dark + blue accent
  { bg: '1a0a2e', text: 'ffffff', accent: 'a855f7' }, // Deep purple + violet accent
  { bg: '0f172a', text: 'f1f5f9', accent: '38bdf8' }, // Slate dark + sky blue
  { bg: '1c1917', text: 'fafaf9', accent: 'f97316' }, // Warm dark + orange
  { bg: '0a1628', text: 'ffffff', accent: '22d3ee' }, // Navy + cyan
  { bg: '14120e', text: 'fef3c7', accent: 'fbbf24' }, // Dark gold theme
  { bg: '0e0e10', text: 'ffffff', accent: 'ef4444' }, // Pure dark + red accent
];

let schemeIndex = 0;

function getNextScheme() {
  const scheme = COLOR_SCHEMES[schemeIndex % COLOR_SCHEMES.length];
  schemeIndex++;
  return scheme;
}

/**
 * Split text into lines that fit the video width.
 * ffmpeg drawtext doesn't auto-wrap, so we do it manually.
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
 * Extract 3 slides from post content:
 * 1. Hook (first impactful line)
 * 2. Value (main content)
 * 3. CTA (call to action)
 */
function extractSlides(message: string, topic: string): { hook: string; value: string; cta: string } {
  // Split by double newlines or single newlines
  const parts = message.split(/\n\n+|\n/).map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length >= 3) {
    // Use first part as hook, middle as value, last as CTA
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

  // Single block — split by sentences
  const sentences = message.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  return {
    hook: (sentences[0] || topic).substring(0, 120),
    value: (sentences[1] || sentences[0] || topic).substring(0, 150),
    cta: sentences.length > 2 ? sentences[sentences.length - 1].substring(0, 100) : 'O que voce acha? Comenta ai!',
  };
}

/**
 * Escape text for ffmpeg drawtext filter (handle special chars)
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

export interface TextVideoSlides {
  hook: string;
  value: string;
  cta: string;
}

/**
 * Generate a text-based animated video using ffmpeg drawtext.
 *
 * Creates 3 slides with fade-in text on dark background.
 * Style: premium dark theme like viral Reels/TikTok posts.
 */
export async function generateTextVideo(
  message: string,
  topic: string,
  customSlides?: TextVideoSlides
): Promise<{ videoPath: string; slides: TextVideoSlides }> {
  const slides = customSlides || extractSlides(message, topic);
  const scheme = getNextScheme();
  const videoPath = path.join(os.tmpdir(), `agency_textvideo_${Date.now()}.mp4`);

  // Wrap text for each slide
  const hookWrapped = wrapText(slides.hook, 25);
  const valueWrapped = wrapText(slides.value, 28);
  const ctaWrapped = wrapText(slides.cta, 30);

  // Font path — use system fonts (ffmpeg format)
  const fontCandidates = [
    { check: 'C:\\Windows\\Fonts\\arialbd.ttf', ffmpeg: 'C\\\\:/Windows/Fonts/arialbd.ttf' },
    { check: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', ffmpeg: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
    { check: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', ffmpeg: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' },
  ];

  let fontArg = '';
  for (const f of fontCandidates) {
    if (fs.existsSync(f.check)) {
      fontArg = `fontfile=${f.ffmpeg}:`;
      break;
    }
  }

  // Calculate font sizes
  const hookFS = hookWrapped.length > 60 ? 52 : 62;
  const valueFS = valueWrapped.length > 80 ? 42 : 48;
  const ctaFS = ctaWrapped.length > 60 ? 40 : 46;

  // Escape for drawtext
  const hookEsc = escapeForDrawtext(hookWrapped);
  const valueEsc = escapeForDrawtext(valueWrapped);
  const ctaEsc = escapeForDrawtext(ctaWrapped);

  // Slide timing
  const s1End = SLIDE_DURATION;
  const s2Start = SLIDE_DURATION;
  const s2End = SLIDE_DURATION * 2;
  const s3Start = SLIDE_DURATION * 2;
  const fade = 0.5;

  // Build chained drawtext filters (applied sequentially to same stream)
  const filters = [
    // Slide 1: Hook text — visible from 0 to s1End with fade in/out
    `drawtext=${fontArg}text='${hookEsc}':fontcolor=0x${scheme.text}:fontsize=${hookFS}:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t\\,${fade})\\,t/${fade}\\,if(gt(t\\,${s1End - fade})\\,if(lt(t\\,${s1End})\\,(${s1End}-t)/${fade}\\,0)\\,1))'`,

    // Slide 1: Accent underline
    `drawtext=${fontArg}text='____':fontcolor=0x${scheme.accent}:fontsize=36:x=(w-text_w)/2:y=(h/2)+120:alpha='if(lt(t\\,${fade + 0.2})\\,0\\,if(lt(t\\,${fade + 0.7})\\,(t-${fade + 0.2})/${fade}\\,if(gt(t\\,${s1End - fade})\\,if(lt(t\\,${s1End})\\,(${s1End}-t)/${fade}\\,0)\\,1)))'`,

    // Slide 2: Value text — visible from s2Start to s2End
    `drawtext=${fontArg}text='${valueEsc}':fontcolor=0x${scheme.text}:fontsize=${valueFS}:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t\\,${s2Start})\\,0\\,if(lt(t\\,${s2Start + fade})\\,(t-${s2Start})/${fade}\\,if(gt(t\\,${s2End - fade})\\,if(lt(t\\,${s2End})\\,(${s2End}-t)/${fade}\\,0)\\,1)))'`,

    // Slide 3: CTA text — visible from s3Start to end
    `drawtext=${fontArg}text='${ctaEsc}':fontcolor=0x${scheme.accent}:fontsize=${ctaFS}:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t\\,${s3Start})\\,0\\,if(lt(t\\,${s3Start + fade})\\,(t-${s3Start})/${fade}\\,1))'`,
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
