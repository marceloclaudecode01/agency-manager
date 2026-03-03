import axios, { AxiosInstance, AxiosError } from 'axios';
import fs from 'fs';
import FormData from 'form-data';

// Fix #1: Graph API v19.0 → v22.0 (current stable)
const GRAPH_API = 'https://graph.facebook.com/v22.0';

type PublishOptions = {
  scheduledTime?: string;
  linkUrl?: string | null;
  platform?: 'facebook' | 'instagram' | 'both';
};

type PublishMediaOptions = PublishOptions & {
  mediaType?: 'image' | 'video' | null;
};

// Cache do Page Token para não converter a cada request
let cachedPageToken: string | null = null;
let pageTokenExpiresAt = 0;

// Fix #7: Invalidar cache quando token expirar
function invalidateTokenCache() {
  cachedPageToken = null;
  pageTokenExpiresAt = 0;
}

function isAuthError(err: any): boolean {
  const fbCode = err.response?.data?.error?.code;
  const status = err.response?.status;
  // 190 = token expired/invalid, 102 = session expired, 401 = unauthorized
  return status === 401 || fbCode === 190 || fbCode === 102;
}

// Fix #4: Axios instance with retry/rate-limit interceptor
const fbApi: AxiosInstance = axios.create();

fbApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as any;
  if (!config) throw error;

  // Fix #7: Invalidate cache on auth errors
  if (isAuthError(error)) {
    invalidateTokenCache();
    console.warn('[SocialService] Token invalidated due to auth error');
  }

  // Rate limit (429) or server error (500/502/503): retry with backoff
  const status = error.response?.status || 0;
  const retryable = status === 429 || status >= 500;
  const attempt = config._retryCount || 0;
  const maxRetries = 2;

  if (retryable && attempt < maxRetries) {
    config._retryCount = attempt + 1;
    const delay = status === 429
      ? 60_000 // rate limit: wait 60s
      : (attempt + 1) * 5_000; // server error: 5s, 10s
    console.warn(`[SocialService] Retry ${config._retryCount}/${maxRetries} after ${delay}ms (HTTP ${status})`);
    await new Promise((r) => setTimeout(r, delay));
    return fbApi.request(config);
  }

  throw error;
});

// Fix #2: Helper to build auth headers instead of query params
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function getUserToken() {
  const token = (process.env.FACEBOOK_ACCESS_TOKEN || '').trim();
  if (!token || token === 'cole_seu_novo_token_aqui') {
    throw { statusCode: 503, message: 'Facebook token not configured' };
  }
  return token;
}

function getPageId() {
  const id = process.env.FACEBOOK_PAGE_ID;
  if (!id || id === 'cole_o_page_id_aqui') {
    throw { statusCode: 503, message: 'Facebook page ID not configured' };
  }
  return id;
}

async function getPageToken(): Promise<string> {
  // Cache válido por 1h
  if (cachedPageToken && Date.now() < pageTokenExpiresAt) {
    return cachedPageToken;
  }

  const userToken = getUserToken();
  const pageId = getPageId();

  try {
    const { data } = await fbApi.get(`${GRAPH_API}/${pageId}`, {
      params: { fields: 'access_token' },
      headers: authHeaders(userToken),
    });

    if (data.access_token) {
      cachedPageToken = data.access_token;
      pageTokenExpiresAt = Date.now() + 60 * 60 * 1000;
      console.log('[SocialService] Page token obtained successfully');
      return data.access_token as string;
    }
  } catch (err: any) {
    console.warn('[SocialService] Could not get page token, falling back to user token:', err.response?.data?.error?.message || err.message);
  }

  // Fallback: o token configurado já pode ser um Page Token
  return userToken;
}

export class SocialService {
  async getPageInfo() {
    const token = await getPageToken();
    const pageId = getPageId();
    const { data } = await fbApi.get(`${GRAPH_API}/${pageId}`, {
      params: {
        fields: 'id,name,fan_count,followers_count,about,category,picture,cover,website',
      },
      headers: authHeaders(token),
    });
    return data;
  }

  async getPageInsights(period: 'day' | 'week' | 'month' = 'month') {
    const token = await getPageToken();
    const pageId = getPageId();

    const metrics = [
      'page_impressions',
      'page_impressions_unique',
      'page_engaged_users',
      'page_post_engagements',
      'page_fans',
      'page_fan_adds',
      'page_views_total',
    ].join(',');

    const { data } = await fbApi.get(`${GRAPH_API}/${pageId}/insights`, {
      params: { metric: metrics, period },
      headers: authHeaders(token),
    });

    const insights: Record<string, any> = {};
    for (const item of data.data || []) {
      insights[item.name] = {
        value: item.values?.[item.values.length - 1]?.value ?? 0,
        previous: item.values?.[item.values.length - 2]?.value ?? 0,
        values: item.values || [],
      };
    }
    return insights;
  }

  async getPosts(limit = 10) {
    const token = await getPageToken();
    const pageId = getPageId();
    try {
      const { data } = await fbApi.get(`${GRAPH_API}/${pageId}/posts`, {
        params: {
          fields: 'id,message,story,created_time,full_picture,permalink_url',
          limit,
        },
        headers: authHeaders(token),
      });
      return data.data || [];
    } catch (err: any) {
      const fbMsg = err.response?.data?.error?.message || err.message;
      const fbCode = err.response?.data?.error?.code;
      console.error(`[SocialService] getPosts error (FB code ${fbCode}): ${fbMsg}`);
      const exposed: any = new Error(`[FB ${fbCode}] ${fbMsg}`);
      exposed.statusCode = err.response?.status || 500;
      exposed.fbResponse = err.response?.data;
      throw exposed;
    }
  }

  private withSchedule(params: Record<string, any>, scheduledTime?: string) {
    if (!scheduledTime) return params;
    return {
      ...params,
      scheduled_publish_time: Math.floor(new Date(scheduledTime).getTime() / 1000),
      published: false,
    };
  }

  private buildMessageWithLink(message: string, linkUrl?: string | null) {
    if (!linkUrl) return message;
    return `${message}\n\n${linkUrl}`;
  }

  async publishPost(message: string, options?: PublishOptions) {
    const token = await getPageToken();
    const pageId = getPageId();

    const finalMessage = this.buildMessageWithLink(message, options?.linkUrl);
    const params = this.withSchedule({ message: finalMessage }, options?.scheduledTime);

    const { data } = await fbApi.post(`${GRAPH_API}/${pageId}/feed`, null, {
      params,
      headers: authHeaders(token),
    });
    return data;
  }

  // Fix #3: campo "caption" → "message" (API /photos usa "message" para legenda)
  async publishPhotoPost(message: string, imageUrl: string, options?: PublishOptions) {
    const token = await getPageToken();
    const pageId = getPageId();

    const finalMessage = this.buildMessageWithLink(message, options?.linkUrl);
    const params = this.withSchedule(
      {
        message: finalMessage,
        url: imageUrl,
      },
      options?.scheduledTime,
    );

    const { data } = await fbApi.post(`${GRAPH_API}/${pageId}/photos`, null, {
      params,
      headers: authHeaders(token),
    });
    return data;
  }

  async publishVideoPost(message: string, videoUrl: string, options?: PublishOptions) {
    const token = await getPageToken();
    const pageId = getPageId();

    const finalDescription = this.buildMessageWithLink(message, options?.linkUrl);
    const params = this.withSchedule(
      {
        description: finalDescription,
        file_url: videoUrl,
      },
      options?.scheduledTime,
    );

    const { data } = await fbApi.post(`${GRAPH_API}/${pageId}/videos`, null, {
      params,
      headers: authHeaders(token),
    });
    return data;
  }

  async publishMediaPost(message: string, mediaUrl: string, options?: PublishMediaOptions) {
    if (options?.mediaType === 'video') {
      return this.publishVideoPost(message, mediaUrl, options);
    }

    if (options?.mediaType === 'image') {
      return this.publishPhotoPost(message, mediaUrl, options);
    }

    const isVideoByUrl = /\.(mp4|mov|avi|m4v)(\?|$)/i.test(mediaUrl);
    return isVideoByUrl
      ? this.publishVideoPost(message, mediaUrl, options)
      : this.publishPhotoPost(message, mediaUrl, options);
  }

  // Fix #6: error handling no getScheduledPosts
  async getScheduledPosts() {
    const token = await getPageToken();
    const pageId = getPageId();
    try {
      const { data } = await fbApi.get(`${GRAPH_API}/${pageId}/scheduled_posts`, {
        params: {
          fields: 'id,message,scheduled_publish_time,full_picture',
        },
        headers: authHeaders(token),
      });
      return data.data || [];
    } catch (err: any) {
      console.error('[SocialService] getScheduledPosts error:', err.response?.data?.error?.message || err.message);
      return [];
    }
  }

  async deletePost(postId: string) {
    const token = await getPageToken();
    const { data } = await fbApi.delete(`${GRAPH_API}/${postId}`, {
      headers: authHeaders(token),
    });
    return data;
  }

  async getPostComments(postId: string) {
    const token = await getPageToken();
    const { data } = await fbApi.get(`${GRAPH_API}/${postId}/comments`, {
      params: {
        fields: 'id,message,from,created_time,like_count',
      },
      headers: authHeaders(token),
    });
    return data.data || [];
  }

  async replyToComment(commentId: string, message: string): Promise<void> {
    const token = await getPageToken();
    await fbApi.post(`${GRAPH_API}/${commentId}/comments`, null, {
      params: { message },
      headers: authHeaders(token),
    });
  }

  // Fix #5: Token no header ao invés de FormData body no video upload
  async publishVideoFromFile(message: string, filePath: string) {
    const token = await getPageToken();
    const pageId = getPageId();

    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    form.append('description', message);

    const { data } = await fbApi.post(`${GRAPH_API}/${pageId}/videos`, form, {
      headers: {
        ...form.getHeaders(),
        ...authHeaders(token),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000,
    });
    return data;
  }

  async checkConnection() {
    try {
      const info = await this.getPageInfo();
      return { connected: true, page: info };
    } catch (err: any) {
      return { connected: false, error: err.message || 'Connection failed' };
    }
  }

}
