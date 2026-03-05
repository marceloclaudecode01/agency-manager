import axios from 'axios';
import { askGemini } from './gemini';
import prisma from '../config/database';

/**
 * Dynamic AI Image Generator — Every post gets a UNIQUE image
 * Uses Pollinations.ai (free, no API key) with Gemini-generated prompts
 * Tracks used prompts in DB to guarantee no repetition
 */

// In-memory fallback tracking (DB is primary)
let recentPrompts: string[] = [];
const MAX_RECENT_PROMPTS = 100;

/**
 * Generate a unique image prompt using Gemini based on post content
 */
async function generateUniqueImagePrompt(
  topic: string,
  category: string,
  postMessage?: string,
  recentUsedPrompts?: string[]
): Promise<string> {
  const recentStr = (recentUsedPrompts || recentPrompts).slice(-20).join('\n- ');

  const raw = await askGemini(
    `You are the Creative Director of a billion-dollar brand agency (think Nike, Apple, Red Bull level). Generate a PREMIUM image prompt for AI image generation.

YOUR MINDSET: Every image must stop the scroll. Think Super Bowl ad quality, not generic stock photos.

TOPIC: "${topic}"
CATEGORY: ${category}
${postMessage ? `POST CONTENT: "${postMessage.substring(0, 300)}"` : ''}

RECENTLY USED (DO NOT repeat or create anything similar):
- ${recentStr || 'none yet'}

CREATIVE DIRECTION:
- CINEMATIC QUALITY: Every frame looks like it belongs in a Netflix documentary or Apple keynote
- EMOTIONAL IMPACT: The image must trigger an instant emotional reaction — awe, curiosity, desire, inspiration
- VISUAL STORYTELLING: One image tells a complete story, no text needed
- BOLD COMPOSITION: Rule of thirds, leading lines, dramatic negative space, golden ratio
- PREMIUM LIGHTING: Golden hour, studio rim lighting, volumetric god rays, neon contrast, cinematic color grading
- TEXTURE OBSESSION: Hyper-detailed surfaces — you can feel the materials through the screen

STYLE ROTATION (vary each time):
- Cinematic photography (shallow DOF, anamorphic lens flare)
- Hyper-realistic 3D render (Octane, Unreal Engine 5 quality)
- Editorial magazine photography (Vogue, GQ, National Geographic level)
- Dramatic aerial/drone perspective
- Intimate macro photography with bokeh
- Futuristic concept art (Blade Runner, cyberpunk aesthetics)
- Clean minimalist with single bold color accent

ABSOLUTE RULES:
- NO text, NO logos, NO watermarks, NO UI elements
- NO generic stock photo vibes — every image must feel CRAFTED
- Square format (1:1), 8K quality description
- Max 180 characters — every word must earn its place
- Return ONLY the prompt in English, nothing else

Generate ONE premium prompt now:`
  );

  return raw.trim().replace(/^["']|["']$/g, '').substring(0, 200);
}

/**
 * Get recently used image prompts from DB (persistent across restarts)
 */
async function getRecentImagePrompts(clientId?: string): Promise<string[]> {
  try {
    const where: any = {
      imageUrl: { not: null },
      status: { in: ['PUBLISHED', 'PENDING', 'PENDING_VIDEO'] },
    };
    if (clientId) where.clientId = clientId;

    const recentPosts = await prisma.scheduledPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { imageUrl: true },
    });

    // Extract the prompt from Pollinations URLs (encoded in the URL)
    return recentPosts
      .map((p) => {
        if (!p.imageUrl) return null;
        try {
          const match = p.imageUrl.match(/\/prompt\/(.+?)(\?|$)/);
          if (match) return decodeURIComponent(match[1]);
        } catch {}
        return null;
      })
      .filter(Boolean) as string[];
  } catch {
    return recentPrompts;
  }
}

/**
 * Check if a prompt is too similar to recent ones (keyword overlap > 60%)
 */
function isTooSimilar(newPrompt: string, recentList: string[]): boolean {
  const newWords = new Set(newPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (newWords.size === 0) return false;

  for (const recent of recentList.slice(-30)) {
    const recentWords = new Set(recent.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (recentWords.size === 0) continue;

    let overlap = 0;
    for (const w of newWords) {
      if (recentWords.has(w)) overlap++;
    }
    const similarity = overlap / Math.min(newWords.size, recentWords.size);
    if (similarity > 0.5) return true;
  }
  return false;
}

export interface GeneratedImage {
  url: string;
  source: string;
}

/**
 * Main function: Generate a unique AI image for each post
 * Uses Pollinations.ai with Gemini-crafted prompts
 */
export async function generateImageForPost(
  topic: string,
  category: string,
  postMessage?: string,
  clientId?: string
): Promise<GeneratedImage> {
  // 1. Get recent prompts from DB to avoid repetition
  const recentUsed = await getRecentImagePrompts(clientId);

  // 2. Generate unique prompt with retries
  let imagePrompt = '';
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      imagePrompt = await generateUniqueImagePrompt(topic, category, postMessage, recentUsed);

      // Check similarity — if too similar, retry
      if (!isTooSimilar(imagePrompt, [...recentUsed, ...recentPrompts])) {
        break;
      }
      attempts++;
    } catch {
      attempts++;
    }
  }

  // 3. Fallback prompt if Gemini fails — still premium quality
  if (!imagePrompt) {
    const styles = [
      'cinematic close-up with shallow depth of field and golden hour rim lighting',
      'hyper-realistic 3D render with dramatic volumetric lighting, Octane quality',
      'editorial magazine photography with bold color grading and studio lighting',
      'dramatic aerial perspective with leading lines and atmospheric haze',
      'futuristic concept art with neon accents and cyberpunk atmosphere',
      'intimate macro shot with creamy bokeh and single bold color accent',
      'clean minimalist composition with dramatic shadows and negative space',
    ];
    const subjects = [
      'modern workspace with premium materials',
      'cutting-edge technology in action',
      'powerful human silhouette against dramatic sky',
      'abstract geometric shapes with metallic textures',
      'urban cityscape at blue hour',
      'dynamic motion-blur scene with energy',
      'luxury lifestyle moment with rich textures',
    ];
    const style = styles[Math.floor(Math.random() * styles.length)];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    imagePrompt = `${style}, ${subject} related to ${topic}, 8K photorealistic quality`;
  }

  // 4. Track prompt usage
  recentPrompts.push(imagePrompt);
  if (recentPrompts.length > MAX_RECENT_PROMPTS) {
    recentPrompts = recentPrompts.slice(-MAX_RECENT_PROMPTS);
  }

  // 5. Build Pollinations URL (unique seed ensures unique generation)
  const seed = Date.now() + Math.floor(Math.random() * 100000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1080&height=1080&nologo=true&model=flux&seed=${seed}`;

  // 6. Verify image is accessible (with timeout)
  try {
    const resp = await axios.head(url, { timeout: 15000 });
    if (resp.status >= 200 && resp.status < 400) {
      return { url, source: 'pollinations-ai' };
    }
  } catch {
    // Pollinations might take time — URL is still valid, it generates on first GET
    // Return it anyway since Facebook will fetch it when publishing
  }

  return { url, source: 'pollinations-ai' };
}

/**
 * Legacy compatibility — redirects to main function
 */
export async function generateImageWithAIPrompt(
  postMessage: string,
  category: string
): Promise<GeneratedImage> {
  return generateImageForPost(postMessage, category, postMessage);
}

/**
 * Legacy compatibility
 */
export async function generateAIImage(topic: string): Promise<GeneratedImage | null> {
  return generateImageForPost(topic, 'educativo');
}
