import api from './index.js';
import { getUserId } from '../utils/auth.js';

export const getGuardians = () => api.get('/guardians');

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

export const getGuardianAlerts = () => api.get(`/care/guardians/${getUserId()}/alerts`);
export const acknowledgeAlert = (alertId, resolved = false) =>
  api.patch(`/care/alerts/${alertId}`, { resolved });
export const getLatestLocation = (seniorId) => api.get(`/care/seniors/${seniorId}/locations/latest`);
export const getSafetyZone = (seniorId) => api.get(`/care/seniors/${seniorId}/safety-zone`);
export const saveSafetyZone = (seniorId, data) => api.put(`/care/seniors/${seniorId}/safety-zone`, data);
export const deleteSafetyZone = (seniorId, zoneId) => api.delete(`/care/seniors/${seniorId}/safety-zone/${zoneId}`);
export const getCheckIns = (seniorId) => api.get(`/care/seniors/${seniorId}/check-ins`);
export const getCareEvents = (seniorId) => api.get(`/care/seniors/${seniorId}/events`);
