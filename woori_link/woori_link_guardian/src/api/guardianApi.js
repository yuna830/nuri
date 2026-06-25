import api from './index.js';
import { getUserId } from '../utils/auth.js';

export const getSeniorsByGuardian = () =>
  api.get(`/seniors/by-guardian/${getUserId()}`);

export const getSenior = (id) => api.get(`/seniors/${id}`);

export const getLatestRisk = (seniorId) =>
  api.get(`/risk/senior/${seniorId}/latest`);

export const assessRisk = (seniorId) =>
  api.post(`/risk/assess/${seniorId}`);

export const getProductsBySenior = (seniorId) =>
  api.get(`/products/senior/${seniorId}`);

export const getActionsBySenior = (seniorId) =>
  api.get(`/actions/senior/${seniorId}`);
