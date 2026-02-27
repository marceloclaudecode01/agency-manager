import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
    if (error.response?.status === 401 && typeof window !== 'undefined' && !isAuthRoute) {
      window.location.href = '/login';
      error.isAuthRedirect = true;
    }
    return Promise.reject(error);
  }
);

export default api;
