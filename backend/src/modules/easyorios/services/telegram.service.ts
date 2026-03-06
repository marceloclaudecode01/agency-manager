import prisma from '../../../config/database';
import { getEasyoriosResponse } from '../easyorios-brain.service';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<any> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`[Telegram] Send failed: ${res.status} ${err}`);
    return null;
  }

  return res.json();
}

export async function setTelegramWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data: any = await res.json();
  console.log(`[Telegram] Webhook set: ${data.ok ? 'success' : data.description}`);
  return data.ok === true;
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = String(msg.chat.id);
  const text = msg.text;

  // Find channel by externalId
  const channel = await prisma.communicationChannel.findFirst({
    where: { platform: 'telegram', externalId: chatId, isActive: true },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!channel) {
    // Unknown chat — send instructions
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      await sendTelegramMessage(botToken, chatId,
        'Easyorios: canal nao vinculado. Use o comando "conectar telegram" no chat web para vincular.'
      );
    }
    return;
  }

  // Log inbound message
  await prisma.communicationMessage.create({
    data: {
      userId: channel.userId,
      channelId: channel.id,
      direction: 'inbound',
      content: text,
      externalMsgId: String(msg.message_id),
    },
  });

  // Get history from recent messages
  const recentMsgs = await prisma.communicationMessage.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const history = recentMsgs.reverse().slice(0, -1).map(m => ({
    role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.content,
  }));

  // Process through Easyorios brain
  const response = await getEasyoriosResponse(text, history, channel.userId, channel.user.role);

  // Log outbound message
  await prisma.communicationMessage.create({
    data: {
      userId: channel.userId,
      channelId: channel.id,
      direction: 'outbound',
      content: response.response,
    },
  });

  // Send reply via Telegram
  const botToken = channel.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    await sendTelegramMessage(botToken, chatId, response.response);
  }
}
