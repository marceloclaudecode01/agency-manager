import axios from 'axios';
import { URL } from 'url';
import dns from 'dns/promises';
import { askGemini } from './gemini';

export interface ProductInfo {
  name: string;
  price: string;
  description: string;
  category: string;
  sourceDomain: string;
  highlights: string[];
  imageUrl?: string;
}

// SSRF protection: block requests to private/internal networks
const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0', '[::1]'];

function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^127\./.test(ip)) return true;           // 127.0.0.0/8
  if (/^10\./.test(ip)) return true;            // 10.0.0.0/8
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true; // 172.16.0.0/12
  if (/^192\.168\./.test(ip)) return true;      // 192.168.0.0/16
  if (/^169\.254\./.test(ip)) return true;      // link-local
  if (ip === '0.0.0.0') return true;
  // IPv6 loopback and private
  if (ip === '::1' || ip === '::') return true;
  if (/^f[cd]/i.test(ip)) return true;          // fc00::/7
  if (/^fe80/i.test(ip)) return true;           // link-local
  return false;
}

async function validateUrlSafety(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL inválida');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Apenas URLs HTTP/HTTPS são permitidas');
  }

  if (BLOCKED_HOSTNAMES.includes(parsed.hostname)) {
    throw new Error('URL bloqueada: endereço interno');
  }

  // Resolve DNS and check if it points to a private IP
  try {
    const { address } = await dns.lookup(parsed.hostname);
    if (isPrivateIP(address)) {
      throw new Error('URL bloqueada: resolve para endereço interno');
    }
  } catch (err: any) {
    if (err.message.includes('bloqueada')) throw err;
    // DNS resolution failed — let axios handle it
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'link';
  }
}

function extractImageFromHtml(html: string): string | undefined {
  // og:image
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImage) return ogImage[1];
  // twitter:image
  const twitterImage = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (twitterImage) return twitterImage[1];
  return undefined;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

export async function analyzeProductLink(url: string): Promise<ProductInfo> {
  let finalUrl = url;
  let pageText = '';
  let imageUrl: string | undefined;
  const domain = extractDomain(url);

  try {
    // SSRF protection: validate URL before fetching
    await validateUrlSafety(url);

    // Resolve redirects (links curtos vt.tiktok.com, etc.)
    const response = await axios.get(url, {
      timeout: 15000,
      headers: BROWSER_HEADERS,
      maxRedirects: 10,
      validateStatus: (status) => status < 500,
    });

    finalUrl = response.request?.res?.responseUrl || response.config?.url || url;
    const html = typeof response.data === 'string' ? response.data : '';
    pageText = extractTextFromHtml(html);
    imageUrl = extractImageFromHtml(html);
  } catch (err: any) {
    console.warn('[LinkAnalyzer] Erro ao acessar URL:', err.message);
    pageText = `Produto disponível em ${domain}`;
  }

  const finalDomain = extractDomain(finalUrl);

  const prompt = `
Você é um especialista em análise de produtos para marketing digital.

URL original: ${url}
URL final (após redirect): ${finalUrl}
Domínio: ${finalDomain}
Conteúdo da página:
---
${pageText}
---

Analise as informações e extraia os dados do produto.
Se for um link do TikTok Shop (tiktok.com/shop), Shopee, Amazon, Mercado Livre, AliExpress — use o contexto para inferir o produto.
Se não conseguir identificar um campo, faça uma estimativa inteligente.

Retorne APENAS JSON válido:
{
  "name": "nome comercial e atrativo do produto",
  "price": "preço com moeda (ex: R$ 49,90) ou 'Consulte o link'",
  "description": "descrição do produto em 1-2 frases persuasivas",
  "category": "categoria (Beleza, Moda, Casa, Tecnologia, Fitness, Alimentos, etc)",
  "highlights": ["benefício ou diferencial 1", "benefício 2", "benefício 3"]
}

Regras:
- name: nome limpo, sem códigos ou IDs
- highlights: 3 pontos que geram desejo de compra
- description: foco em benefício, não em características técnicas
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Não foi possível analisar o produto');

  const info = JSON.parse(jsonMatch[0]);
  return {
    name: info.name || 'Produto',
    price: info.price || 'Consulte o link',
    description: info.description || '',
    category: info.category || 'Geral',
    sourceDomain: finalDomain,
    highlights: info.highlights || [],
    imageUrl,
  };
}
