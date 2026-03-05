/**
 * Content Atomizer — 1 Post → 5 Formats (ZERO tokens)
 *
 * Transforms a single post into multiple content formats using
 * pure rule-based logic. No LLM calls, no API calls, no internet.
 *
 * Formats:
 * 1. Post normal (original — already exists)
 * 2. Carrossel (5 slides from post structure)
 * 3. Video (text-based animated slides)
 * 4. Thread (4-6 connected short posts)
 * 5. Ad Copy (conversion-optimized version)
 *
 * This replaces the old Content Replicator LLM approach
 * (which burned 6 LLM calls per post) with zero-token logic.
 */

import { PostStructure } from '../agents/content-creator.agent';

// ─── Types ───────────────────────────────────────────────────

export interface AtomizedContent {
  carousel: CarouselFormat;
  video: VideoFormat;
  thread: ThreadFormat;
  adCopy: AdCopyFormat;
}

export interface CarouselFormat {
  slides: Array<{
    slideNumber: number;
    title: string;
    body: string;
    type: 'cover' | 'content' | 'proof' | 'cta';
  }>;
  caption: string;
}

export interface VideoFormat {
  hook: string;
  value: string;
  cta: string;
}

export interface ThreadFormat {
  posts: string[];
}

export interface AdCopyFormat {
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
}

// ─── Core Atomizer ───────────────────────────────────────────

/**
 * Atomize a post into all 5 formats at once.
 * Uses the PostStructure (5-step framework) when available,
 * falls back to text splitting when not.
 */
export function atomizePost(
  message: string,
  topic: string,
  structure?: PostStructure | null
): AtomizedContent {
  // Extract structure from message if not provided
  const parts = structure || extractStructureFromText(message, topic);

  return {
    carousel: buildCarousel(parts, topic),
    video: buildVideoSlides(parts),
    thread: buildThread(parts, topic),
    adCopy: buildAdCopy(parts, topic),
  };
}

// ─── Carousel Builder ────────────────────────────────────────

function buildCarousel(
  s: PostStructure,
  topic: string
): CarouselFormat {
  const slides = [
    {
      slideNumber: 1,
      title: truncate(s.hook, 60),
      body: '',
      type: 'cover' as const,
    },
    {
      slideNumber: 2,
      title: 'O problema',
      body: truncate(s.contexto, 150),
      type: 'content' as const,
    },
    {
      slideNumber: 3,
      title: 'A solucao',
      body: truncate(s.valor, 150),
      type: 'content' as const,
    },
    {
      slideNumber: 4,
      title: 'Prova real',
      body: truncate(s.micro_prova, 150),
      type: 'proof' as const,
    },
    {
      slideNumber: 5,
      title: truncate(s.cta, 60),
      body: 'Salva e compartilha com quem precisa ver!',
      type: 'cta' as const,
    },
  ];

  const caption = `${s.hook}\n\nDesliza pra ver tudo.\n\n${s.cta}`;

  return { slides, caption: truncate(caption, 500) };
}

// ─── Video Slides Builder ────────────────────────────────────

function buildVideoSlides(s: PostStructure): VideoFormat {
  return {
    hook: truncate(s.hook, 120),
    value: truncate(s.contexto + ' ' + s.valor, 200),
    cta: truncate(s.cta, 100),
  };
}

// ─── Thread Builder ──────────────────────────────────────────

function buildThread(s: PostStructure, topic: string): ThreadFormat {
  const posts: string[] = [];
  const seen = new Set<string>();

  const addUnique = (text: string) => {
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 10 || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  };

  // Post 1: Hook (attention grabber)
  if (addUnique(s.hook)) posts.push(`1/ ${truncate(s.hook, 270)}`);

  // Post 2: Context (the problem)
  if (addUnique(s.contexto)) posts.push(`${posts.length + 1}/ ${truncate(s.contexto, 270)}`);

  // Post 3: Value (the insight)
  if (addUnique(s.valor)) posts.push(`${posts.length + 1}/ ${truncate(s.valor, 270)}`);

  // Post 4: Proof
  if (s.micro_prova && addUnique(s.micro_prova)) {
    posts.push(`${posts.length + 1}/ ${truncate(s.micro_prova, 270)}`);
  }

  // Last post: CTA
  if (addUnique(s.cta)) {
    posts.push(`${posts.length + 1}/ ${truncate(s.cta, 250)}\n\nSalva essa thread.`);
  } else if (posts.length > 0) {
    // Append CTA to last post if it's a duplicate
    posts[posts.length - 1] += '\n\nSalva essa thread.';
  }

  // Minimum 2 posts for a thread
  if (posts.length < 2) {
    posts.length = 0;
    posts.push(`1/ ${truncate(topic, 270)}`);
    posts.push(`2/ ${truncate(s.hook || s.valor, 250)}\n\nSalva essa thread.`);
  }

  return { posts };
}

// ─── Ad Copy Builder ─────────────────────────────────────────

function buildAdCopy(s: PostStructure, topic: string): AdCopyFormat {
  // Headline: short, punchy version of hook
  const hookWords = s.hook.split(/\s+/);
  const headline = hookWords.length > 6
    ? hookWords.slice(0, 6).join(' ') + '...'
    : s.hook;

  // Primary text: combine context + value for persuasion
  const primaryText = truncate(s.contexto + ' ' + s.valor, 125);

  // Description: short proof
  const description = truncate(s.micro_prova, 30);

  return {
    headline: truncate(headline, 40),
    primaryText,
    description,
    cta: 'LEARN_MORE',
  };
}

// ─── Text Structure Extraction ───────────────────────────────

/**
 * Extract a PostStructure from raw message text.
 * Used when the LLM didn't return a structured post.
 */
function extractStructureFromText(message: string, topic: string): PostStructure {
  const paragraphs = message
    .split(/\n\n+|\n/)
    .map(p => p.trim())
    .filter(p => p.length > 5);

  if (paragraphs.length >= 5) {
    return {
      hook: paragraphs[0],
      contexto: paragraphs[1],
      valor: paragraphs[2],
      micro_prova: paragraphs[3],
      cta: paragraphs[paragraphs.length - 1],
    };
  }

  if (paragraphs.length >= 3) {
    return {
      hook: paragraphs[0],
      contexto: paragraphs[1],
      valor: paragraphs[Math.floor(paragraphs.length / 2)],
      micro_prova: paragraphs.length > 3 ? paragraphs[paragraphs.length - 2] : paragraphs[1],
      cta: paragraphs[paragraphs.length - 1],
    };
  }

  // Minimal: split by sentences — avoid repeating content
  const sentences = message.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const unique = [...new Set(sentences)];
  return {
    hook: unique[0] || topic,
    contexto: unique[1] || topic,
    valor: unique[2] || unique[1] || topic,
    micro_prova: unique.length > 3 ? unique[3] : '',
    cta: unique.length > 2 ? unique[unique.length - 1] : 'O que voce acha? Comenta!',
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > maxLen * 0.7 ? cut.substring(0, lastSpace) + '...' : cut + '...';
}
