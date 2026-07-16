import api from './index'

export const getRecalledProducts = () => api.get('/products/recalled')
export const getRecalledProductsByWelfareWorker = (id) =>
  api.get(`/products/recalled/welfare-worker/${id}`)
export const getProductsBySenior = (seniorId) => api.get(`/products/senior/${seniorId}`)
export const registerProduct = (data) => api.post('/products', data)
export const refreshRecall = () => api.post('/products/refresh')
export const updateCurrentUseStatus = (id, status) =>
  api.patch(`/products/${id}/current-use`, null, { params: { status } })
export const updateRecallWorkflow = (id, data) => api.patch(`/products/${id}/workflow`, data)
export const deleteProduct = (id) => api.delete(`/products/${id}`)
