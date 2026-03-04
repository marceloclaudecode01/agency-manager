/**
 * Platform Optimizer Agent
 * 100% rule-based (zero LLM) — adjusts post per platform
 * Called inline in the content generation pipeline, not a cron
 */

export interface PlatformRules {
  maxLength: number;
  hashtagLimit: number;
  ctaStyle: string;
  structureNotes: string;
}

const PLATFORM_RULES: Record<string, PlatformRules> = {
  facebook: {
    maxLength: 600,
    hashtagLimit: 5,
    ctaStyle: 'Pergunta aberta ou "marca alguem"',
    structureNotes: 'Texto corrido com quebras de linha. Sem links no corpo (penaliza alcance). Hashtags no final.',
  },
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    ctaStyle: '"Link na bio" ou "salva esse post"',
    structureNotes: 'Legenda longa permitida. Hashtags no primeiro comentario ou no final. Carrossel preferido.',
  },
  tiktok: {
    maxLength: 300,
    hashtagLimit: 5,
    ctaStyle: 'CTA curto e direto, "comenta" ou "dueto"',
    structureNotes: 'Texto ultra-curto. Hook nos primeiros 3 segundos. Trending sounds.',
  },
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    ctaStyle: '"Concorda? Comenta sua visao" ou "Compartilha com seu time"',
    structureNotes: 'Tom profissional. Dados e insights. Primeira linha = hook forte. Sem emojis excessivos.',
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 2,
    ctaStyle: '"RT se concorda" ou pergunta curta',
    structureNotes: 'Ultra-conciso. Thread se precisar de mais espaço. Hook = o tweet inteiro.',
  },
};

export interface OptimizedPost {
  message: string;
  hashtags: string[];
  platform: string;
  adjustments: string[];
}

export function optimizeForPlatform(
  message: string,
  hashtags: string[],
  platform: string
): OptimizedPost {
  const rules = PLATFORM_RULES[platform] || PLATFORM_RULES.facebook;
  const adjustments: string[] = [];

  let optimizedMessage = message;
  let optimizedHashtags = [...hashtags];

  // Truncate message if exceeds platform limit
  if (optimizedMessage.length > rules.maxLength) {
    // Try to cut at last sentence boundary
    const truncated = optimizedMessage.substring(0, rules.maxLength);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    if (lastPeriod > rules.maxLength * 0.7) {
      optimizedMessage = truncated.substring(0, lastPeriod + 1);
    } else {
      optimizedMessage = truncated.trimEnd() + '...';
    }
    adjustments.push(`Texto truncado de ${message.length} para ${optimizedMessage.length} chars`);
  }

  // Limit hashtags
  if (optimizedHashtags.length > rules.hashtagLimit) {
    optimizedHashtags = optimizedHashtags.slice(0, rules.hashtagLimit);
    adjustments.push(`Hashtags limitadas a ${rules.hashtagLimit}`);
  }

  // Platform-specific adjustments
  if (platform === 'facebook') {
    // Remove URLs from body (Facebook penalizes link posts for organic reach)
    const urlRegex = /https?:\/\/\S+/gi;
    if (urlRegex.test(optimizedMessage)) {
      optimizedMessage = optimizedMessage.replace(urlRegex, '').replace(/\s{2,}/g, ' ').trim();
      adjustments.push('Links removidos do corpo (Facebook penaliza)');
    }
  }

  if (platform === 'twitter') {
    // Ensure first line is strong (the tweet IS the hook)
    const lines = optimizedMessage.split('\n').filter(l => l.trim());
    if (lines.length > 1 && lines[0].length > 200) {
      optimizedMessage = lines[0].substring(0, 270);
      adjustments.push('Reduzido a single-tweet (thread não suportada automaticamente)');
    }
  }

  if (adjustments.length === 0) {
    adjustments.push('Nenhum ajuste necessário');
  }

  return {
    message: optimizedMessage,
    hashtags: optimizedHashtags,
    platform,
    adjustments,
  };
}

export function getPlatformRules(platform: string): PlatformRules {
  return PLATFORM_RULES[platform] || PLATFORM_RULES.facebook;
}

export function getSupportedPlatforms(): string[] {
  return Object.keys(PLATFORM_RULES);
}
