import axios from 'axios';
import { SPRING_API_BASE_URL } from '../config/api.js';

const baseApi = axios.create({
  baseURL: SPRING_API_BASE_URL,
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
