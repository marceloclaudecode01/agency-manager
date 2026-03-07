import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import { askGemini } from '../../../agents/gemini';
import prisma from '../../../config/database';

const CACHE_TTL = 30 * 60 * 1000; // 30 min

async function getCachedResult(query: string): Promise<string | null> {
  try {
    const cached = await prisma.searchCache.findFirst({
      where: { query, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return cached?.result || null;
  } catch {
    return null;
  }
}

async function setCachedResult(query: string, result: string): Promise<void> {
  try {
    await prisma.searchCache.create({
      data: {
        query,
        result,
        expiresAt: new Date(Date.now() + CACHE_TTL),
      },
    });
  } catch {}
}

async function cleanExpiredCache(): Promise<void> {
  try {
    await prisma.searchCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {}
}

async function fetchWebContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Easyorios/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Strip HTML tags, get text content
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.substring(0, 5000); // limit for LLM context
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDuckDuckGoResults(query: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // DuckDuckGo lite page has results in <a class="result-link"> and snippets in <td class="result-snippet">
    const results: string[] = [];
    // Extract result links + snippets
    const linkRegex = /class="result-link"[^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const titles: string[] = [];
    const snippets: string[] = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) titles.push(m[1].trim());
    while ((m = snippetRegex.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) snippets.push(text);
    }

    for (let i = 0; i < Math.min(titles.length, 5); i++) {
      const snippet = snippets[i] || '';
      results.push(`${titles[i]}${snippet ? ': ' + snippet : ''}`);
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWeb(query: string): Promise<string> {
  // Step 1: Try real web search via DuckDuckGo
  const webResults = await fetchDuckDuckGoResults(query);

  if (webResults.length > 0) {
    // Step 2: Pass real results to Gemini for synthesis
    const resultsBlock = webResults.map((r, i) => `${i + 1}. ${r}`).join('\n');
    const prompt = `Com base nestes resultados REAIS de busca na web, responda a pergunta do usuario de forma concisa e util em portugues brasileiro. Cite as fontes quando relevante.

Resultados de busca:
${resultsBlock}

Pergunta: ${query}

Resposta:`;
    return askGemini(prompt);
  }

  // Step 3: Fallback — ask Gemini directly with disclaimer
  const prompt = `Voce e um assistente de pesquisa. Responda a seguinte pergunta de forma concisa e util, em portugues brasileiro. IMPORTANTE: Avise que esta resposta e baseada no seu conhecimento interno, sem acesso a web em tempo real.

Pergunta: ${query}

Resposta:`;
  return askGemini(prompt);
}

async function summarizeUrl(url: string): Promise<string> {
  const content = await fetchWebContent(url);
  if (!content || content.length < 50) {
    return 'Nao foi possivel extrair conteudo dessa pagina.';
  }

  const prompt = `Resuma o seguinte conteudo de forma concisa em portugues brasileiro (maximo 300 palavras):

${content.substring(0, 4000)}

Resumo:`;

  return askGemini(prompt);
}

export class WebSearchModule implements EasyoriosModule {
  id = 'search';
  name = 'Pesquisa Web';
  icon = 'Search';
  contextPriority = 5;

  getCommands(): CommandDefinition[] {
    return [
      // ─── Search ───
      {
        name: 'web_search',
        description: 'Pesquisar na web',
        patterns: [
          /(?:pesquisar?|search|buscar?|procurar?)\s+(.+)/i,
          /(?:o\s+que\s+[eé]|quem\s+[eé]|como\s+funciona|me\s+explica|explique)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, _userId) => {
          const query = (match[1] || match[2])?.trim();
          if (!query) return { command: 'web_search', success: false, message: 'Informe o que deseja pesquisar.' };

          // Check cache
          const cached = await getCachedResult(query);
          if (cached) {
            return {
              command: 'web_search',
              success: true,
              message: cached,
              data: { query, cached: true },
            };
          }

          try {
            const result = await searchWeb(query);
            await setCachedResult(query, result);

            // Clean expired cache periodically
            cleanExpiredCache();

            return {
              command: 'web_search',
              success: true,
              message: result,
              data: { query, cached: false },
            };
          } catch (e: any) {
            return {
              command: 'web_search',
              success: false,
              message: `Falha na pesquisa: ${e.message}`,
            };
          }
        },
      },
      // ─── News ───
      {
        name: 'news_search',
        description: 'Buscar noticias',
        patterns: [
          /(?:noticias?|news|novidades?)\s+(?:sobre|de|do|da)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, _userId) => {
          const topic = match[1]?.trim();
          if (!topic) return { command: 'news_search', success: false, message: 'Informe o topico.' };

          const cacheKey = `news:${topic}`;
          const cached = await getCachedResult(cacheKey);
          if (cached) {
            return { command: 'news_search', success: true, message: cached, data: { topic, cached: true } };
          }

          try {
            const webResults = await fetchDuckDuckGoResults(`${topic} noticias`);
            let result: string;
            if (webResults.length > 0) {
              const resultsBlock = webResults.map((r, i) => `${i + 1}. ${r}`).join('\n');
              result = await askGemini(`Com base nestas noticias reais da web, faca um resumo das principais noticias sobre "${topic}" em portugues brasileiro. Seja conciso, liste 3-5 pontos.\n\nResultados:\n${resultsBlock}\n\nResumo:`);
            } else {
              result = await askGemini(`Liste as principais noticias recentes sobre "${topic}" em portugues brasileiro. Avise que e baseado no seu conhecimento interno. Seja conciso, liste 3-5 pontos.\n\nNoticias sobre ${topic}:`);
            }
            await setCachedResult(cacheKey, result);

            return { command: 'news_search', success: true, message: result, data: { topic, cached: false } };
          } catch (e: any) {
            return { command: 'news_search', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Summarize URL ───
      {
        name: 'summarize_url',
        description: 'Resumir pagina web',
        patterns: [
          /(?:resumir?|summarize|resumo\s+(?:de|do|da))\s+(https?:\/\/\S+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, _userId) => {
          const url = match[1]?.trim();
          if (!url) return { command: 'summarize_url', success: false, message: 'Informe a URL.' };

          const cached = await getCachedResult(`url:${url}`);
          if (cached) {
            return { command: 'summarize_url', success: true, message: cached, data: { url, cached: true } };
          }

          try {
            const summary = await summarizeUrl(url);
            await setCachedResult(`url:${url}`, summary);
            return { command: 'summarize_url', success: true, message: summary, data: { url, cached: false } };
          } catch (e: any) {
            return { command: 'summarize_url', success: false, message: `Falha ao resumir: ${e.message}` };
          }
        },
      },
    ];
  }

  async gatherContext(_userId: string): Promise<ModuleContext> {
    let cacheCount = 0;
    try {
      cacheCount = await prisma.searchCache.count({ where: { expiresAt: { gt: new Date() } } });
    } catch {}

    return {
      moduleId: 'search',
      summary: `${cacheCount} resultados em cache`,
      metrics: { activeCacheEntries: cacheCount },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Noticias Tech', prompt: 'noticias sobre tecnologia', icon: 'Newspaper', moduleId: 'search' },
      { label: 'Noticias Brasil', prompt: 'noticias sobre Brasil', icon: 'Globe', moduleId: 'search' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    return []; // Search module is reactive, no proactive alerts
  }
}
