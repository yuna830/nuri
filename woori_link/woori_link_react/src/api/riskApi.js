import api from './index'

export const getLatestRisk = (seniorId) => api.get(`/risk/senior/${seniorId}/latest`)
export const getHighRisk = () => api.get('/risk/high-risk')
export const assessRisk = (seniorId) => api.post(`/risk/assess/${seniorId}`)
export const assessAll = () => api.post('/risk/assess-all')
