import axios from 'axios';
import { SPRING_API_BASE_URL } from '../config/api.js';

const baseApi = axios.create({
  baseURL: SPRING_API_BASE_URL,
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

export const findWelfareLoginId = (data) =>
  baseApi.post('/welfare-auth/find-loginid', data);

export const resetWelfarePassword = (data) =>
  baseApi.post('/welfare-auth/reset-password', data);

export const searchFacilities = (name) =>
  baseApi.get(`/welfare-facilities/search?name=${encodeURIComponent(name)}`);
