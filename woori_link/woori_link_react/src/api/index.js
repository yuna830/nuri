import axios from 'axios';
import { clearUser, getToken } from '../utils/auth.js';
import { SPRING_API_BASE_URL } from '../config/api.js';

const api = axios.create({
  baseURL: SPRING_API_BASE_URL,
  withCredentials: true, // 쿠키 자동 첨부
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status

    if (status === 401) {
      const isAuthPage =
        window.location.pathname.includes('/login') ||
        window.location.pathname.includes('/register')

      if (!isAuthPage) {
        const isGuardianPage = window.location.pathname.startsWith('/guardian')
        clearUser()
        window.location.href = isGuardianPage ? '/guardian/login' : '/welfare/login'
      }
    }

    return Promise.reject(err)
  }
)

export default api;
