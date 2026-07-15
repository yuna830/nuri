import api from './index'

export const getEnergySupportCandidates = (welfareWorkerId, type) =>
  api.get('/energy-support/candidates', { params: { welfareWorkerId, type } })

export const updateEnergySupportCase = (seniorId, type, data) =>
  api.put(`/energy-support/${seniorId}/${type}`, data)
