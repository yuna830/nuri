import axios from 'axios';

const baseApi = axios.create({
  baseURL: 'http://localhost:8090/api',
  withCredentials: true,
});

export const guardianLogin = (phone, password) =>
  baseApi.post('/guardian-auth/login', { phone, password });

export const guardianLogout = () =>
  baseApi.post('/guardian-auth/logout');

export const registerGuardian = (data) =>
  baseApi.post('/guardian-auth/register', data);

export const resetGuardianPassword = (data) =>
  baseApi.post('/guardian-auth/reset-password', data);
