import axios, { AxiosError } from 'axios';

/**
 * Axios instance configured for API requests.
 *
 * 开发/网页版：走 Vite 代理或 nginx 转发。
 * - 部署在域名子路径 /vs 时（如 https://sanzizyf.asia/vs），API 前缀为 /vs/api；
 * - 其余（IP 根路径、开发代理）为 /api。
 * 安卓 APK（Capacitor WebView 没有代理）：用构建时注入的
 *   VITE_API_BASE_URL（绝对地址）覆盖上述前缀。
 */
const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const webBase = window.location.pathname.startsWith('/sr') ? '/sr/api' : window.location.pathname.startsWith('/vs') ? '/vs/api' : '/api';
export const API_BASE: string = envBase && envBase.length ? envBase : webBase;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor
 * Automatically adds authentication token to requests if available
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handles common error scenarios like 401 unauthorized
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized - clear auth state
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // 需要跳转登录页时可启用：
      // window.location.href = '/login';
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden');
    }

    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      console.error('Server error occurred');
    }

    return Promise.reject(error);
  }
);

/**
 * Type-safe error handler for API errors
 * 将常见失败（超时/断网/413 过大/5xx）转成可读中文提示。
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<{ message?: string }>;
    const status = e.response?.status;
    const serverMsg = e.response?.data?.message;
    if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message || '')) {
      return '网络超时，请检查网络后重试';
    }
    if (!e.response) return '网络异常，请检查网络连接';
    if (status === 400) return serverMsg || '请求不被接受，请检查内容后重试';
    if (status === 401) return '登录已失效，请重新登录';
    if (status === 403) return '没有权限执行此操作';
    if (status === 413) return '图片过大，请压缩或更换后重试';
    if (status === 429) return '操作过于频繁，请稍后再试';
    if (status && status >= 500) return '服务器开小差了，请稍后重试';
    return serverMsg || e.message || '请求失败，请稍后重试';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '发生未知错误';
}

export default apiClient;

