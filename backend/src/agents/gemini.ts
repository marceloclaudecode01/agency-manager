import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

/**
 * Multi-LLM Provider with automatic fallback:
 * 1. Gemini 2.0 Flash (Google AI Studio — 1500 req/day free)
 * 2. Groq (Llama 3.3 70B — 100k tokens/day free)
 * 3. OpenRouter (Llama 3.3 70B :free — unlimited free models)
 *
 * If provider 1 fails (429/quota), tries provider 2, then 3.
 * Env vars: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
 */

// ─── Provider 1: Gemini ───
let geminiClient: GoogleGenerativeAI | null = null;

async function askGeminiProvider(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  if (!geminiClient) geminiClient = new GoogleGenerativeAI(apiKey);
  const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text() || '';
}

// ─── Provider 2: Groq ───
let groqClient: Groq | null = null;

async function askGroqProvider(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  if (!groqClient) groqClient = new Groq({ apiKey });
  const completion = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return completion.choices[0]?.message?.content || '';
}

// ─── Provider 3: OpenRouter (free models, OpenAI-compatible) ───
// Multiple free models — tries each until one responds (they share rate limits upstream)
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'google/gemma-3-27b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-4b-it:free',
];

async function askOpenRouterProvider(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://agency-manager-production.up.railway.app',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (res.status === 429) {
        console.log(`[LLM] OpenRouter ${model} rate limited — trying next model...`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log(`[LLM] OpenRouter ${model} error ${res.status} — trying next model...`);
        continue;
      }

      const data: any = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content) {
        console.log(`[LLM] ✓ OpenRouter ${model} responded`);
        return content;
      }
    } catch (err: any) {
      console.log(`[LLM] OpenRouter ${model} failed: ${(err?.message || '').substring(0, 80)} — trying next model...`);
      continue;
    }
  }

  throw new Error('OpenRouter: all free models rate limited');
}

// ─── Providers config (order = priority) ───
interface Provider {
  name: string;
  fn: (prompt: string) => Promise<string>;
  envKey: string;
}

const PROVIDERS: Provider[] = [
  { name: 'Gemini', fn: askGeminiProvider, envKey: 'GEMINI_API_KEY' },
  { name: 'Groq', fn: askGroqProvider, envKey: 'GROQ_API_KEY' },
  { name: 'OpenRouter', fn: askOpenRouterProvider, envKey: 'OPENROUTER_API_KEY' },
];

function isRateLimitError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 429 || msg.includes('429') || msg.includes('rate') || msg.includes('quota') || msg.includes('exceeded');
}

// ─── Main function (used by ALL agents) ───
export async function askGemini(prompt: string): Promise<string> {
  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!process.env[provider.envKey]) continue; // skip if no key configured

    try {
      const result = await provider.fn(prompt);
      if (result) {
        if (provider.name !== 'Gemini') console.log(`[LLM] ✓ ${provider.name} responded successfully (fallback)`);
        return result;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      errors.push(`${provider.name}: ${errMsg.substring(0, 100)}`);

      if (isRateLimitError(err)) {
        console.log(`[LLM] ${provider.name} rate limit — trying next provider...`);
        continue; // try next provider
      }
      // Non-rate-limit error — still try next provider
      console.log(`[LLM] ${provider.name} error: ${errMsg.substring(0, 100)} — trying next...`);
      continue;
    }
  }

  throw new Error(`All LLM providers failed: ${errors.join(' | ')}`);
}
