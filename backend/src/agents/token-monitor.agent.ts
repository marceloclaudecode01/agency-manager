import axios from 'axios';
import prisma from '../config/database';
import { notificationsService } from '../modules/notifications/notifications.service';

export interface TokenStatus {
  isValid: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  appName: string;
  scopes: string[];
}

export async function checkFacebookToken(): Promise<TokenStatus> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) {
    return { isValid: false, expiresAt: null, daysUntilExpiry: null, appName: '', scopes: [] };
  }

  try {
    const res = await axios.get('https://graph.facebook.com/v22.0/debug_token', {
      params: { input_token: token },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const data = res.data?.data;
    if (!data?.is_valid) {
      return { isValid: false, expiresAt: null, daysUntilExpiry: null, appName: data?.application || '', scopes: [] };
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : null;
    const daysUntilExpiry = expiresAt
      ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      isValid: true,
      expiresAt,
      daysUntilExpiry,
      appName: data.application || '',
      scopes: data.scopes || [],
    };
  } catch (err: any) {
    console.error('[TokenMonitor] Erro ao verificar token:', err.message);
    return { isValid: false, expiresAt: null, daysUntilExpiry: null, appName: '', scopes: [] };
  }
}

/**
 * FIX #3: Auto-exchange short-lived token for long-lived token (60 days).
 * Requires FACEBOOK_APP_ID and FACEBOOK_APP_SECRET env vars.
 * If exchange succeeds, updates process.env.FACEBOOK_ACCESS_TOKEN in-memory
 * and stores the new token in SystemConfig for persistence across restarts.
 */
async function tryExchangeLongLivedToken(): Promise<boolean> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const currentToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!appId || !appSecret || !currentToken) {
    return false;
  }

  try {
    const { data } = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: currentToken,
      },
      timeout: 15000,
    });

    if (data.access_token && data.access_token !== currentToken) {
      // Update in-memory token
      process.env.FACEBOOK_ACCESS_TOKEN = data.access_token;

      // Persist to SystemConfig for boot.ts to read on restart
      await prisma.systemConfig.upsert({
        where: { key: 'facebook_long_lived_token' },
        update: {
          value: {
            token: data.access_token,
            exchangedAt: new Date().toISOString(),
            expiresIn: data.expires_in || 5184000, // default 60 days
          },
        },
        create: {
          key: 'facebook_long_lived_token',
          value: {
            token: data.access_token,
            exchangedAt: new Date().toISOString(),
            expiresIn: data.expires_in || 5184000,
          },
        },
      });

      console.log(`[TokenMonitor] Token exchanged for long-lived token (expires in ${Math.floor((data.expires_in || 5184000) / 86400)} days)`);
      return true;
    }
  } catch (err: any) {
    console.warn(`[TokenMonitor] Long-lived token exchange failed: ${err.message}`);
  }
  return false;
}

/**
 * On startup, check if we have a persisted long-lived token in SystemConfig
 * that is newer than the env var token. If so, use it.
 */
export async function restorePersistedToken(): Promise<void> {
  try {
    const stored = await prisma.systemConfig.findUnique({ where: { key: 'facebook_long_lived_token' } });
    if (stored?.value && (stored.value as any).token) {
      const storedToken = (stored.value as any).token;
      const currentToken = process.env.FACEBOOK_ACCESS_TOKEN;
      if (storedToken && storedToken !== currentToken) {
        // Verify the stored token is still valid
        const res = await axios.get('https://graph.facebook.com/v22.0/debug_token', {
          params: { input_token: storedToken },
          headers: { Authorization: `Bearer ${storedToken}` },
          timeout: 10000,
        });
        if (res.data?.data?.is_valid) {
          process.env.FACEBOOK_ACCESS_TOKEN = storedToken;
          console.log('[TokenMonitor] Restored persisted long-lived token from DB');
        }
      }
    }
  } catch {
    // Non-blocking — continue with env token
  }
}

export async function runTokenMonitor(): Promise<void> {
  const status = await checkFacebookToken();
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });

  if (!status.isValid) {
    console.warn('[TokenMonitor] Token inválido ou expirado!');

    // FIX #3: Try to restore persisted token before giving up
    await restorePersistedToken();
    const retryStatus = await checkFacebookToken();
    if (retryStatus.isValid) {
      console.log('[TokenMonitor] Token restaurado do banco com sucesso!');
      return;
    }

    for (const admin of admins) {
      await notificationsService.createAndEmit(
        admin.id,
        'TASK_ASSIGNED',
        'Token Facebook EXPIRADO',
        'O token do Facebook expirou! Acesse Meta Business Manager e gere um novo token.'
      );
    }
    return;
  }

  // FIX #3: Auto-exchange when token expires in <= 7 days
  if (status.daysUntilExpiry !== null && status.daysUntilExpiry <= 7) {
    console.log(`[TokenMonitor] Token expira em ${status.daysUntilExpiry} dias — tentando exchange para long-lived...`);
    const exchanged = await tryExchangeLongLivedToken();
    if (exchanged) {
      // Re-check after exchange
      const newStatus = await checkFacebookToken();
      if (newStatus.isValid && newStatus.daysUntilExpiry && newStatus.daysUntilExpiry > 7) {
        console.log(`[TokenMonitor] Token renovado automaticamente! Novo expiry: ${newStatus.daysUntilExpiry} dias`);
        for (const admin of admins) {
          await notificationsService.createAndEmit(
            admin.id,
            'TASK_ASSIGNED',
            'Token Facebook renovado automaticamente!',
            `Token trocado por long-lived. Novo prazo: ${newStatus.expiresAt?.toLocaleDateString('pt-BR')} (${newStatus.daysUntilExpiry} dias)`
          );
        }
        return;
      }
    }
  }

  if (status.daysUntilExpiry !== null) {
    console.log(`[TokenMonitor] Token válido. Expira em ${status.daysUntilExpiry} dias.`);

    if (status.daysUntilExpiry <= 7) {
      for (const admin of admins) {
        await notificationsService.createAndEmit(
          admin.id,
          'TASK_ASSIGNED',
          `Token Facebook expira em ${status.daysUntilExpiry} dias!`,
          `Auto-exchange falhou. Acesse Meta Business Manager → Usuários do Sistema → agency-system → Gerar novo token. Expira em: ${status.expiresAt?.toLocaleDateString('pt-BR')}`
        );
      }
    } else if (status.daysUntilExpiry <= 15) {
      for (const admin of admins) {
        await notificationsService.createAndEmit(
          admin.id,
          'TASK_ASSIGNED',
          `Atenção: Token Facebook expira em ${status.daysUntilExpiry} dias`,
          `Renove o token em breve para não interromper as publicações automáticas.`
        );
      }
    }
  }
}
