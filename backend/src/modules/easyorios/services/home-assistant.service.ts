/**
 * Home Assistant REST API client.
 * Env vars: HOME_ASSISTANT_URL (e.g. http://192.168.1.100:8123), HOME_ASSISTANT_TOKEN
 */

const getConfig = () => ({
  url: process.env.HOME_ASSISTANT_URL || '',
  token: process.env.HOME_ASSISTANT_TOKEN || '',
});

async function haFetch(path: string, options: RequestInit = {}): Promise<any> {
  const { url, token } = getConfig();
  if (!url || !token) throw new Error('Home Assistant nao configurado (HOME_ASSISTANT_URL / HOME_ASSISTANT_TOKEN).');

  const res = await fetch(`${url}/api${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HA API ${res.status}: ${text.substring(0, 200)}`);
  }

  return res.json();
}

export function isHomeAssistantConfigured(): boolean {
  const { url, token } = getConfig();
  return !!(url && token);
}

export async function getStates(): Promise<any[]> {
  return haFetch('/states');
}

export async function getEntityState(entityId: string): Promise<any> {
  return haFetch(`/states/${entityId}`);
}

export async function callService(
  domain: string,
  service: string,
  data: Record<string, any> = {},
): Promise<any> {
  return haFetch(`/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function turnOn(entityId: string, data: Record<string, any> = {}): Promise<any> {
  const domain = entityId.split('.')[0];
  return callService(domain, 'turn_on', { entity_id: entityId, ...data });
}

export async function turnOff(entityId: string): Promise<any> {
  const domain = entityId.split('.')[0];
  return callService(domain, 'turn_off', { entity_id: entityId });
}

export async function toggle(entityId: string): Promise<any> {
  const domain = entityId.split('.')[0];
  return callService(domain, 'toggle', { entity_id: entityId });
}

export async function setClimate(entityId: string, temperature: number, hvacMode?: string): Promise<any> {
  const data: any = { entity_id: entityId, temperature };
  if (hvacMode) data.hvac_mode = hvacMode;
  return callService('climate', 'set_temperature', data);
}

export async function discoverDevices(): Promise<Array<{ entityId: string; name: string; type: string; state: string }>> {
  const states = await getStates();
  const supportedDomains = ['light', 'switch', 'climate', 'sensor', 'cover', 'media_player', 'fan', 'lock'];

  return states
    .filter((s: any) => supportedDomains.includes(s.entity_id.split('.')[0]))
    .map((s: any) => ({
      entityId: s.entity_id,
      name: s.attributes?.friendly_name || s.entity_id,
      type: s.entity_id.split('.')[0],
      state: s.state,
    }));
}
