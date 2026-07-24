import api from './index'

export const getActionsBySenior = (seniorId) => api.get(`/actions/senior/${seniorId}`)
export const getActionsByWelfareWorker = (id) => api.get(`/actions/welfare-worker/${id}`)
export const getPendingActions = () => api.get('/actions/pending')
export const createAction = (data) => api.post('/actions', data)
export const updateAction = (id, data) => api.patch(`/actions/${id}`, data)
export const updateActionStatus = (id, status, note) =>
  api.patch(`/actions/${id}/status`, null, { params: { status, note } })
export const deleteAction = (id) => api.delete(`/actions/${id}`)
