import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8090/api',
  withCredentials: true, // 쿠키 자동 첨부
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;