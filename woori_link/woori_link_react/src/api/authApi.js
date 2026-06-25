import axios from 'axios';

const baseApi = axios.create({ baseURL: 'http://localhost:8090/api' });

export const login = (phone, password) =>
  baseApi.post('/auth/login', { phone, password });

export const register = (data) =>
  baseApi.post('/auth/register', data);
