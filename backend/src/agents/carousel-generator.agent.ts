/**
 * Carousel Generator Agent
 * Maps 5-step post structure → 5 slides for carousel format
 * 100% rule-based (zero LLM) — uses structure from content-creator
 * Auto-generates carousels for "autoridade" posts
 */

import { PostStructure } from './content-creator.agent';

export interface CarouselSlide {
  slideNumber: number;
  title: string;
  body: string;
  type: 'cover' | 'content' | 'proof' | 'cta';
}

export interface CarouselOutput {
  slides: CarouselSlide[];
  caption: string;
  slideCount: number;
}

// Map 5-step structure → 5 carousel slides
export function generateCarouselFromStructure(
  structure: PostStructure,
  topic: string
): CarouselOutput {
  const slides: CarouselSlide[] = [
    {
      slideNumber: 1,
      title: truncate(structure.hook, 60),
      body: '',
      type: 'cover',
    },
    {
      slideNumber: 2,
      title: 'O problema',
      body: truncate(structure.contexto, 150),
      type: 'content',
    },
    {
      slideNumber: 3,
      title: 'A solucao',
      body: truncate(structure.valor, 150),
      type: 'content',
    },
    {
      slideNumber: 4,
      title: 'Prova real',
      body: truncate(structure.micro_prova, 150),
      type: 'proof',
    },
    {
      slideNumber: 5,
      title: truncate(structure.cta, 60),
      body: 'Salva esse post e compartilha com quem precisa ver!',
      type: 'cta',
    },
  ];

  const caption = `${structure.hook}\n\nDesliza pra ver os ${slides.length} passos completos.\n\n${structure.cta}`;

  return {
    slides,
    caption: truncate(caption, 500),
    slideCount: slides.length,
  };
}

// Check if a post should auto-generate carousel (autoridade + has structure)
export function shouldGenerateCarousel(
  contentCategory: string,
  structure?: PostStructure | null
): boolean {
  if (!structure) return false;
  // Auto-carousel for autoridade and educativo posts
  return contentCategory === 'autoridade' || contentCategory === 'educativo';
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > maxLen * 0.7 ? cut.substring(0, lastSpace) + '...' : cut + '...';
}
