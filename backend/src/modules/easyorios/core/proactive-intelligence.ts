import { registry } from './module-registry';
import { askGemini } from '../../../agents/gemini';
import { getUserPreferences } from './memory-engine';

async function getWeather(city: string): Promise<string | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=pt_br`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data: any = await res.json();

    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const desc = data.weather?.[0]?.description || '';
    const humidity = data.main.humidity;

    return `${city}: ${temp}C (sensacao ${feelsLike}C), ${desc}, umidade ${humidity}%`;
  } catch {
    return null;
  }
}

export async function generateDailyDigest(userId: string): Promise<string> {
  const parts: string[] = ['**Digest Diario**\n'];

  // 1. Weather
  const prefs = await getUserPreferences(userId);
  const city = prefs.city || prefs.cidade || null;
  if (city) {
    const weather = await getWeather(city);
    if (weather) parts.push(`**Clima:** ${weather}\n`);
  }

  // 2. Cross-module context summary
  const contexts = await registry.gatherAllContext(userId);
  if (contexts.length > 0) {
    parts.push('**Resumo dos Modulos:**');
    for (const ctx of contexts) {
      parts.push(`- ${ctx.moduleId.toUpperCase()}: ${ctx.summary}`);
    }
    parts.push('');
  }

  // 3. Alerts
  const alerts = await registry.getAllAlerts(userId);
  if (alerts.length > 0) {
    parts.push(`**Alertas (${alerts.length}):**`);
    for (const a of alerts.slice(0, 5)) {
      parts.push(`- [${a.severity}] ${a.title}: ${a.message}`);
    }
  }

  return parts.join('\n');
}

export async function detectAnomalies(userId: string): Promise<string[]> {
  const anomalies: string[] = [];

  try {
    const contexts = await registry.gatherAllContext(userId);

    // Simple anomaly detection: check if any metric seems unusual
    // This is a lightweight check — real ML would need historical data
    for (const ctx of contexts) {
      const metrics = ctx.metrics;
      for (const [key, value] of Object.entries(metrics)) {
        if (typeof value !== 'number') continue;

        // Flag very high or zero values as potential anomalies
        if (value === 0 && key.includes('active')) {
          anomalies.push(`${ctx.moduleId}: ${key} esta em zero`);
        }
      }
    }
  } catch (e: any) {
    console.error('[ProactiveIntel] Anomaly detection error:', e.message);
  }

  return anomalies;
}
