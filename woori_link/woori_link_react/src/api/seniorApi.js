import api from './index'

export const getSeniors = () => api.get('/seniors')
export const getSeniorById = (id) => api.get(`/seniors/${id}`)
export const getSeniorsByWelfareWorker = (id) => api.get(`/seniors/by-welfare-worker/${id}`)
export const getVoucherUnapplied = () => api.get('/seniors/voucher-unapplied')
export const createSenior = (data) => api.post('/seniors', data)
export const updateSenior = (id, data) => api.patch(`/seniors/${id}`, data)
export const updateSeniorProfile = (id, data) => api.put(`/seniors/${id}/profile`, data)
export const deleteSenior = (id) => api.delete(`/seniors/${id}`)

export const searchSeniors = (params) =>
  api.get('/seniors/search', { params })

export const assignWelfareWorker = (id, welfareWorkerId) =>
  api.patch(`/seniors/${id}`, { welfareWorkerId })
