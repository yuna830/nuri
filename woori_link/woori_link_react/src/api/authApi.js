import axios from 'axios';

const baseApi = axios.create({
  baseURL: 'http://localhost:8090/api',
  withCredentials: true,
});

export const login = (loginId, password) =>
  baseApi.post('/welfare-auth/login', { loginId, password });

export const logout = () =>
  baseApi.post('/welfare-auth/logout');

export const registerWelfareWorker = (data) =>
  baseApi.post('/welfare-auth/register', data);

export const checkLoginIdAvailable = (loginId) =>
  baseApi.get(`/welfare-auth/check-loginid?loginId=${encodeURIComponent(loginId)}`);

export const searchFacilities = (name) =>
  baseApi.get(`/welfare-facilities/search?name=${encodeURIComponent(name)}`);
