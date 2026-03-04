import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('[Gemini] GEMINI_API_KEY não configurada!');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export async function askGemini(prompt: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text() || '';
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate') || err?.message?.toLowerCase().includes('quota');
      if (is429 && attempt < retries - 1) {
        console.log(`[Gemini] Rate limit atingido. Aguardando 10s...`);
        await new Promise((r) => setTimeout(r, 10_000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini indisponível após todas as tentativas');
}
