import axios, { AxiosRequestConfig } from 'axios';

// Extend AxiosRequestConfig to support _retry flag
interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
  withCredentials: true,
});

// Promise queue to handle concurrent 401s — only one refresh call is made at a time
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function onRefreshSuccess() {
  pendingRequests.forEach(({ resolve }) => resolve(undefined));
  pendingRequests = [];
}

function onRefreshFailure(error: unknown) {
  pendingRequests.forEach(({ reject }) => reject(error));
  pendingRequests = [];
}

function clearAuthAndRedirect() {
  if (typeof document !== 'undefined') {
    document.cookie = 'auth_flag=; path=/; max-age=0; SameSite=None; Secure';
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig;

    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/me');

    // Agent/growth endpoints: reject silently (Promise.allSettled handles it)
    const isAgentRoute =
      originalRequest?.url?.includes('/agents/') ||
      originalRequest?.url?.includes('/agents?');

    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !isAuthRoute &&
      !originalRequest._retry &&
      !isAgentRoute
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch(() => {
            clearAuthAndRedirect();
            return Promise.reject(error);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        isRefreshing = false;
        onRefreshSuccess();

        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailure(refreshError);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
