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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig;

    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !isAuthRoute &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch(() => {
            window.location.href = '/login';
            return Promise.reject(error);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt token refresh — refresh_token cookie is sent automatically via withCredentials
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        isRefreshing = false;
        onRefreshSuccess();

        // Retry the original request — new access token cookie is now set
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailure(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
