import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import { sendTelegramMessage, setTelegramWebhook } from '../services/telegram.service';
import prisma from '../../../config/database';

export class CommunicationModule implements EasyoriosModule {
  id = 'communication';
  name = 'Comunicacao';
  icon = 'MessageCircle';
  contextPriority = 6;

  getCommands(): CommandDefinition[] {
    return [
      // ─── Connect Telegram ───
      {
        name: 'connect_telegram',
        description: 'Conectar canal Telegram',
        patterns: [
          /(?:conectar?|connect|vincular?|link)\s+(?:o?\s+)?telegram\s+(\d+)/i,
          /telegram\s+(?:chat\s*)?id\s*:?\s*(\d+)/i,
        ],
        requiredRole: 'ADMIN',
        execute: async (match, userId) => {
          const chatId = match[1]?.trim();
          if (!chatId) return { command: 'connect_telegram', success: false, message: 'Informe o chat ID do Telegram.' };

          try {
            const existing = await prisma.communicationChannel.findFirst({
              where: { platform: 'telegram', externalId: chatId },
            });

            if (existing) {
              return { command: 'connect_telegram', success: false, message: `Chat ID ${chatId} ja esta vinculado.` };
            }

            const botToken = process.env.TELEGRAM_BOT_TOKEN || null;

            await prisma.communicationChannel.create({
              data: {
                userId,
                platform: 'telegram',
                externalId: chatId,
                botToken,
                metadata: {},
              },
            });

            // Send confirmation via Telegram
            if (botToken) {
              await sendTelegramMessage(botToken, chatId, 'Easyorios conectado! Agora voce pode enviar mensagens por aqui.');
            }

            return {
              command: 'connect_telegram',
              success: true,
              message: `Telegram vinculado! Chat ID: ${chatId}. Envie mensagens diretamente pelo Telegram.`,
              data: { chatId, platform: 'telegram' },
            };
          } catch (e: any) {
            return { command: 'connect_telegram', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Setup Telegram Webhook ───
      {
        name: 'setup_telegram_webhook',
        description: 'Configurar webhook do Telegram',
        patterns: [
          /(?:configurar?|setup)\s+(?:o?\s+)?webhook\s+(?:do?\s+)?telegram/i,
        ],
        requiredRole: 'ADMIN',
        execute: async (_match, _userId) => {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (!botToken) {
            return { command: 'setup_telegram_webhook', success: false, message: 'TELEGRAM_BOT_TOKEN nao configurado nas env vars.' };
          }

          const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : process.env.BACKEND_URL || 'http://localhost:3333';

          const webhookUrl = `${baseUrl}/api/webhooks/telegram`;

          try {
            const ok = await setTelegramWebhook(botToken, webhookUrl);
            return {
              command: 'setup_telegram_webhook',
              success: ok,
              message: ok
                ? `Webhook configurado: ${webhookUrl}`
                : 'Falha ao configurar webhook no Telegram.',
              data: { webhookUrl },
            };
          } catch (e: any) {
            return { command: 'setup_telegram_webhook', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── Disconnect channel ───
      {
        name: 'disconnect_channel',
        description: 'Desconectar canal',
        patterns: [
          /(?:desconectar?|disconnect|desvincular?|remover?)\s+(?:o?\s+)?(?:canal\s+)?(?:telegram|whatsapp)/i,
        ],
        requiredRole: 'ADMIN',
        execute: async (match, userId) => {
          const platform = /telegram/i.test(match[0]) ? 'telegram' : 'whatsapp';

          try {
            const channel = await prisma.communicationChannel.findFirst({
              where: { userId, platform, isActive: true },
            });

            if (!channel) {
              return { command: 'disconnect_channel', success: false, message: `Nenhum canal ${platform} ativo.` };
            }

            await prisma.communicationChannel.update({
              where: { id: channel.id },
              data: { isActive: false },
            });

            return {
              command: 'disconnect_channel',
              success: true,
              message: `Canal ${platform} desconectado (ID: ${channel.externalId}).`,
            };
          } catch (e: any) {
            return { command: 'disconnect_channel', success: false, message: `Falha: ${e.message}` };
          }
        },
      },
      // ─── List channels ───
      {
        name: 'list_channels',
        description: 'Listar canais conectados',
        patterns: [
          /(?:listar?|list|ver|mostrar?|meus?)\s+(?:os?\s+)?(?:canais?|channels?)/i,
          /(?:canais?|channels?)\s+(?:conectados?|ativos?)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const channels = await prisma.communicationChannel.findMany({
            where: { userId, isActive: true },
          });

          if (channels.length === 0) {
            return { command: 'list_channels', success: true, message: 'Nenhum canal conectado. Use "conectar telegram <chat_id>" para vincular.' };
          }

          const lines = channels.map((c, i) =>
            `${i + 1}. ${c.platform.toUpperCase()} — ID: ${c.externalId} (desde ${c.createdAt.toLocaleDateString('pt-BR')})`
          );

          return {
            command: 'list_channels',
            success: true,
            message: `${channels.length} canal(is) conectado(s):\n${lines.join('\n')}`,
            data: { channels },
          };
        },
      },
      // ─── Send message via channel ───
      {
        name: 'send_telegram',
        description: 'Enviar mensagem via Telegram',
        patterns: [
          /(?:enviar?|send|mandar?)\s+(?:via\s+|pelo?\s+|no\s+)?telegram\s*:?\s*(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const text = match[1]?.trim();
          if (!text) return { command: 'send_telegram', success: false, message: 'Informe a mensagem.' };

          const channel = await prisma.communicationChannel.findFirst({
            where: { userId, platform: 'telegram', isActive: true },
          });

          if (!channel) {
            return { command: 'send_telegram', success: false, message: 'Nenhum canal Telegram ativo. Conecte primeiro.' };
          }

          const botToken = channel.botToken || process.env.TELEGRAM_BOT_TOKEN;
          if (!botToken) {
            return { command: 'send_telegram', success: false, message: 'Bot token nao configurado.' };
          }

          try {
            await sendTelegramMessage(botToken, channel.externalId, text);

            await prisma.communicationMessage.create({
              data: {
                userId,
                channelId: channel.id,
                direction: 'outbound',
                content: text,
              },
            });

            return {
              command: 'send_telegram',
              success: true,
              message: `Mensagem enviada via Telegram: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
            };
          } catch (e: any) {
            return { command: 'send_telegram', success: false, message: `Falha ao enviar: ${e.message}` };
          }
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    const results = await Promise.allSettled([
      prisma.communicationChannel.count({ where: { userId, isActive: true } }),
      prisma.communicationMessage.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 86400000) } },
      }),
    ]);

    const channels = results[0].status === 'fulfilled' ? results[0].value : 0;
    const msgs24h = results[1].status === 'fulfilled' ? results[1].value : 0;

    return {
      moduleId: 'communication',
      summary: `${channels} canal(is) ativo(s) | ${msgs24h} mensagens (24h)`,
      metrics: { activeChannels: channels, messages24h: msgs24h },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Meus Canais', prompt: 'listar canais', icon: 'MessageCircle', moduleId: 'communication' },
      { label: 'Setup Webhook', prompt: 'configurar webhook telegram', icon: 'Settings', moduleId: 'communication' },
    ];
  }

  async getProactiveAlerts(userId: string): Promise<ModuleAlert[]> {
    const alerts: ModuleAlert[] = [];

    try {
      // Alert if there are unread inbound messages (not replied within 1h)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const unreplied = await prisma.communicationMessage.count({
        where: {
          userId,
          direction: 'inbound',
          createdAt: { gte: oneHourAgo },
        },
      });

      if (unreplied > 3) {
        alerts.push({
          id: 'comm-unreplied',
          moduleId: 'communication',
          title: 'Mensagens pendentes',
          message: `${unreplied} mensagens recebidas na ultima hora.`,
          severity: 'info',
          createdAt: new Date(),
        });
      }
    } catch {}

    return alerts;
  }
}
