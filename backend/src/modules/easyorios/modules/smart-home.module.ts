import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import * as ha from '../services/home-assistant.service';
import prisma from '../../../config/database';

// Map PT room names to HA common names
const ROOM_ALIASES: Record<string, string[]> = {
  sala: ['sala', 'living', 'room'],
  quarto: ['quarto', 'bedroom', 'dormitorio'],
  cozinha: ['cozinha', 'kitchen'],
  banheiro: ['banheiro', 'bathroom'],
  escritorio: ['escritorio', 'office'],
  garagem: ['garagem', 'garage'],
  varanda: ['varanda', 'balcony'],
};

function findRoomFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [room, aliases] of Object.entries(ROOM_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return room;
  }
  return null;
}

export class SmartHomeModule implements EasyoriosModule {
  id = 'smarthome';
  name = 'Casa Inteligente';
  icon = 'Home';
  contextPriority = 4;

  getCommands(): CommandDefinition[] {
    return [
      // ─── Turn on/off ───
      {
        name: 'device_on',
        description: 'Ligar dispositivo',
        patterns: [
          /(?:ligar?|acender?|turn\s*on|ativar?)\s+(?:a?\s+|o?\s+)?(?:luz|light|lampada|lâmpada)\s*(?:d[aoe]s?\s+)?(.+)?/i,
          /(?:ligar?|turn\s*on|ativar?)\s+(?:o?\s+|a?\s+)?(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          if (!ha.isHomeAssistantConfigured()) {
            return { command: 'device_on', success: false, message: 'Home Assistant nao configurado. Configure HOME_ASSISTANT_URL e HOME_ASSISTANT_TOKEN.' };
          }

          const target = match[1]?.trim() || '';
          const room = findRoomFromText(target);

          // Find device in DB
          const device = await prisma.smartDevice.findFirst({
            where: {
              userId,
              isActive: true,
              OR: [
                { name: { contains: target, mode: 'insensitive' as any } },
                ...(room ? [{ room }] : []),
                { entityId: { contains: target, mode: 'insensitive' as any } },
              ],
            },
          });

          if (!device) {
            return { command: 'device_on', success: false, message: `Dispositivo "${target}" nao encontrado. Use "descobrir dispositivos" primeiro.` };
          }

          try {
            await ha.turnOn(device.entityId);
            return {
              command: 'device_on',
              success: true,
              message: `${device.name} ligado.`,
              data: { entityId: device.entityId, name: device.name },
            };
          } catch (e: any) {
            return { command: 'device_on', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      {
        name: 'device_off',
        description: 'Desligar dispositivo',
        patterns: [
          /(?:desligar?|apagar?|turn\s*off|desativar?)\s+(?:a?\s+|o?\s+)?(?:luz|light|lampada|lâmpada)\s*(?:d[aoe]s?\s+)?(.+)?/i,
          /(?:desligar?|turn\s*off|desativar?)\s+(?:o?\s+|a?\s+)?(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          if (!ha.isHomeAssistantConfigured()) {
            return { command: 'device_off', success: false, message: 'Home Assistant nao configurado.' };
          }

          const target = match[1]?.trim() || '';
          const room = findRoomFromText(target);

          const device = await prisma.smartDevice.findFirst({
            where: {
              userId, isActive: true,
              OR: [
                { name: { contains: target, mode: 'insensitive' as any } },
                ...(room ? [{ room }] : []),
                { entityId: { contains: target, mode: 'insensitive' as any } },
              ],
            },
          });

          if (!device) {
            return { command: 'device_off', success: false, message: `Dispositivo "${target}" nao encontrado.` };
          }

          try {
            await ha.turnOff(device.entityId);
            return { command: 'device_off', success: true, message: `${device.name} desligado.`, data: { entityId: device.entityId } };
          } catch (e: any) {
            return { command: 'device_off', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Climate ───
      {
        name: 'set_temperature',
        description: 'Ajustar temperatura',
        patterns: [
          /(?:temperatura|temp|ar\s*condicionado|ac)\s+(?:para|em|a)\s+(\d{1,2})\s*(?:graus|°|c)?/i,
          /(?:colocar?|setar?|ajustar?|set)\s+(?:a?\s+)?(?:temperatura|temp|ar)\s+(?:para|em|a)\s+(\d{1,2})/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          if (!ha.isHomeAssistantConfigured()) {
            return { command: 'set_temperature', success: false, message: 'Home Assistant nao configurado.' };
          }

          const temp = parseInt(match[1]);
          if (temp < 16 || temp > 32) {
            return { command: 'set_temperature', success: false, message: 'Temperatura deve ser entre 16 e 32 graus.' };
          }

          const device = await prisma.smartDevice.findFirst({
            where: { userId, type: 'climate', isActive: true },
          });

          if (!device) {
            return { command: 'set_temperature', success: false, message: 'Nenhum dispositivo de climatizacao encontrado.' };
          }

          try {
            await ha.setClimate(device.entityId, temp);
            return { command: 'set_temperature', success: true, message: `Temperatura ajustada para ${temp}°C.`, data: { temperature: temp, entityId: device.entityId } };
          } catch (e: any) {
            return { command: 'set_temperature', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Discover devices ───
      {
        name: 'discover_devices',
        description: 'Descobrir dispositivos do Home Assistant',
        patterns: [
          /(?:descobrir?|discover|sincronizar?|sync)\s+(?:os?\s+)?dispositivos?/i,
          /(?:listar?|list|ver)\s+(?:os?\s+)?dispositivos?\s+(?:da?\s+)?(?:casa|home)/i,
        ],
        requiredRole: 'ADMIN',
        execute: async (_match, userId) => {
          if (!ha.isHomeAssistantConfigured()) {
            return { command: 'discover_devices', success: false, message: 'Home Assistant nao configurado. Configure HOME_ASSISTANT_URL e HOME_ASSISTANT_TOKEN.' };
          }

          try {
            const devices = await ha.discoverDevices();

            let added = 0;
            for (const dev of devices) {
              const existing = await prisma.smartDevice.findFirst({
                where: { userId, entityId: dev.entityId },
              });

              if (!existing) {
                await prisma.smartDevice.create({
                  data: {
                    userId,
                    entityId: dev.entityId,
                    name: dev.name,
                    type: dev.type,
                    room: findRoomFromText(dev.name),
                  },
                });
                added++;
              }
            }

            return {
              command: 'discover_devices',
              success: true,
              message: `Encontrados ${devices.length} dispositivos. ${added} novos adicionados.`,
              data: { total: devices.length, added },
            };
          } catch (e: any) {
            return { command: 'discover_devices', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Device status ───
      {
        name: 'device_status',
        description: 'Status dos dispositivos',
        patterns: [
          /(?:status|estado)\s+(?:d[aoe]s?\s+)?(?:casa|home|dispositivos?|devices?)/i,
          /(?:como\s+esta|como\s+está)\s+(?:a\s+)?casa/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const devices = await prisma.smartDevice.findMany({
            where: { userId, isActive: true },
            orderBy: { type: 'asc' },
          });

          if (devices.length === 0) {
            return { command: 'device_status', success: true, message: 'Nenhum dispositivo cadastrado. Use "descobrir dispositivos" primeiro.' };
          }

          if (!ha.isHomeAssistantConfigured()) {
            const lines = devices.map((d, i) => `${i + 1}. ${d.name} (${d.type}) [${d.room || '?'}]`);
            return { command: 'device_status', success: true, message: `${devices.length} dispositivos cadastrados (HA offline):\n${lines.join('\n')}` };
          }

          try {
            const statuses = await Promise.allSettled(
              devices.map(async d => {
                const state = await ha.getEntityState(d.entityId);
                return { name: d.name, type: d.type, room: d.room, state: state.state, attributes: state.attributes };
              })
            );

            const lines = statuses.map((r, i) => {
              if (r.status === 'fulfilled') {
                const s = r.value;
                const extra = s.type === 'climate' ? ` (${s.attributes?.temperature || '?'}°C)` :
                  s.type === 'sensor' ? ` (${s.state} ${s.attributes?.unit_of_measurement || ''})` : '';
                return `${i + 1}. ${s.name} — ${s.state}${extra} [${s.room || '?'}]`;
              }
              return `${i + 1}. ${devices[i].name} — erro`;
            });

            return {
              command: 'device_status',
              success: true,
              message: `Status da casa (${devices.length} dispositivos):\n${lines.join('\n')}`,
            };
          } catch (e: any) {
            return { command: 'device_status', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Scene activation ───
      {
        name: 'activate_scene',
        description: 'Ativar cena',
        patterns: [
          /(?:ativar?|activate|executar?|rodar?)\s+(?:a?\s+)?(?:cena|scene|modo)\s+(.+)/i,
          /(?:modo|cena)\s+(boa\s*noite|cinema|trabalho|relaxar|acordar|morning|night)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const sceneName = match[1]?.trim().toLowerCase();
          if (!sceneName) return { command: 'activate_scene', success: false, message: 'Informe o nome da cena.' };

          const scene = await prisma.smartScene.findFirst({
            where: { name: { contains: sceneName, mode: 'insensitive' as any }, isActive: true },
          });

          if (!scene) {
            return { command: 'activate_scene', success: false, message: `Cena "${sceneName}" nao encontrada. Cenas disponiveis podem ser listadas com "listar cenas".` };
          }

          if (!ha.isHomeAssistantConfigured()) {
            return { command: 'activate_scene', success: false, message: 'Home Assistant nao configurado.' };
          }

          try {
            const actions = scene.actions as Array<{ entityId: string; service: string; data?: any }>;
            const results = await Promise.allSettled(
              actions.map(a => {
                const [domain, svc] = a.service.split('.');
                return ha.callService(domain, svc, { entity_id: a.entityId, ...a.data });
              })
            );

            const ok = results.filter(r => r.status === 'fulfilled').length;
            return {
              command: 'activate_scene',
              success: true,
              message: `Cena "${scene.name}" ativada (${ok}/${actions.length} acoes executadas).`,
            };
          } catch (e: any) {
            return { command: 'activate_scene', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    const configured = ha.isHomeAssistantConfigured();
    let deviceCount = 0;
    try {
      deviceCount = await prisma.smartDevice.count({ where: { userId, isActive: true } });
    } catch {}

    return {
      moduleId: 'smarthome',
      summary: configured
        ? `${deviceCount} dispositivos | Home Assistant conectado`
        : `${deviceCount} dispositivos | Home Assistant nao configurado`,
      metrics: { deviceCount, haConfigured: configured },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Status Casa', prompt: 'status da casa', icon: 'Home', moduleId: 'smarthome' },
      { label: 'Descobrir Dispositivos', prompt: 'descobrir dispositivos', icon: 'Wifi', moduleId: 'smarthome' },
    ];
  }

  async getProactiveAlerts(userId: string): Promise<ModuleAlert[]> {
    if (!ha.isHomeAssistantConfigured()) return [];

    const alerts: ModuleAlert[] = [];
    try {
      // Check for sensors with critical values
      const sensors = await prisma.smartDevice.findMany({
        where: { userId, type: 'sensor', isActive: true },
      });

      for (const sensor of sensors.slice(0, 5)) { // limit to avoid too many API calls
        try {
          const state = await ha.getEntityState(sensor.entityId);
          const val = parseFloat(state.state);
          if (!isNaN(val)) {
            // Temperature alert
            if (sensor.entityId.includes('temperature') && val > 35) {
              alerts.push({
                id: `smarthome-temp-${sensor.entityId}`,
                moduleId: 'smarthome',
                title: 'Temperatura alta',
                message: `${sensor.name}: ${val}°C`,
                severity: 'warning',
                createdAt: new Date(),
              });
            }
          }
        } catch {}
      }
    } catch {}

    return alerts;
  }
}
