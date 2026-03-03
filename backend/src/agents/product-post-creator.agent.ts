import { askGemini } from './gemini';
import { ProductInfo } from './link-analyzer.agent';

export interface ProductPostResult {
  message: string;
  hashtags: string[];
  replyTemplate: string;
  suggestedTime: string;
}

const COPYWRITER_IDENTITY = `
Você é o melhor copywriter de resposta direta do mundo.
Mente combinada de Gary Halbert, Eugene Schwartz, Alex Hormozi e Russell Brunson.
Escreve para o público brasileiro no Facebook. Tom: próximo, empolgante, humano.
Objetivo: criar DESEJO IMEDIATO de compra e direcionar para o link na bio.
`;

export async function createProductPost(
  product: ProductInfo,
  productUrl: string
): Promise<ProductPostResult> {
  const domain = product.sourceDomain;

  // Detecta a plataforma para adaptar o CTA
  const platformCTAs: Record<string, string> = {
    'shopee.com.br': 'link na bio para garantir o seu na Shopee',
    'amazon.com.br': 'link na bio para ver na Amazon',
    'mercadolivre.com.br': 'link na bio para ver no Mercado Livre',
    'tiktok.com': 'link na bio para comprar no TikTok Shop',
    'shopify': 'link na bio para comprar agora',
  };

  const ctaHint = Object.entries(platformCTAs).find(([k]) => domain.includes(k))?.[1]
    || 'link na bio para garantir o seu';

  const prompt = `
${COPYWRITER_IDENTITY}

Produto para promover:
- Nome: ${product.name}
- Preço: ${product.price}
- Categoria: ${product.category}
- Descrição: ${product.description}
- Destaques: ${product.highlights.join(', ')}
- Plataforma: ${domain}

CTA específico: "${ctaHint}"

Crie um post para Facebook que:
1. Para o scroll na primeira linha (hook irresistível — máx 10 palavras)
2. Apresenta o produto com benefícios reais (não genéricos)
3. Usa gatilho mental (prova social, urgência, transformação ou curiosidade)
4. Termina com CTA: "${ctaHint}"
5. Máximo 280 caracteres no texto (sem hashtags)
6. NAO use emojis — texto puro e direto, apenas caracteres ASCII

Também crie um template de resposta automática para comentários do tipo "quanto custa?", "onde compro?", "link?", "quero!" — resposta deve ser amigável, enviar o link e gerar mais desejo.

Retorne APENAS JSON válido:
{
  "message": "texto do post completo",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4"],
  "replyTemplate": "Oi [NOME]! Que otimo que se interessou. Voce pode garantir o seu aqui: ${productUrl} Aproveita que ainda tem em estoque!",
  "suggestedTime": "HH:MM"
}

Regras para replyTemplate:
- Use [NOME] onde o nome do comentador será inserido automaticamente
- Inclua o link EXATAMENTE assim: ${productUrl}
- Tom amigável e que converte
- Máx 3 linhas
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta inválida do Gemini no criador de post');

  const result = JSON.parse(jsonMatch[0]);

  // Garante que o link está no replyTemplate
  if (!result.replyTemplate.includes(productUrl)) {
    result.replyTemplate = `Oi [NOME]! Aqui esta o link para voce garantir o seu: ${productUrl}`;
  }

  return {
    message: result.message,
    hashtags: result.hashtags || [],
    replyTemplate: result.replyTemplate,
    suggestedTime: result.suggestedTime || '19:00',
  };
}
