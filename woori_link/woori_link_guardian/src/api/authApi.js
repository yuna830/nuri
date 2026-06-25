import axios from 'axios';

const baseApi = axios.create({
  baseURL: 'http://localhost:8090/api',
  withCredentials: true,
});

export const login = (phone, password) =>
  baseApi.post('/auth/login', { phone, password });

export const logout = () =>
  baseApi.post('/auth/logout');

export const registerGuardian = (data) =>
  baseApi.post('/auth/register/guardian', data);
