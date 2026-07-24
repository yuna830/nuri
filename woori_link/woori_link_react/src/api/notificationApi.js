import api from './index'
import { getToken } from '../utils/auth.js'

const authConfig = () => {
  const token = getToken('WELFARE_WORKER')
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

export const createSeniorNotification = (seniorId, data) =>
  api.post(`/care/seniors/${seniorId}/notifications`, data, authConfig())

export const getWelfareNotifications = () =>
  api.get('/care/welfare-notices', authConfig())

export const getWelfareAlerts = () =>
  api.get('/care/welfare-alerts', authConfig())

export const cancelWelfareNotification = (alertId) =>
  api.delete(`/care/welfare-notices/${alertId}`, authConfig())
