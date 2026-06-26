import api from './index'

export const getRecalledProducts = () => api.get('/products/recalled')
export const getProductsBySenior = (seniorId) => api.get(`/products/senior/${seniorId}`)
export const registerProduct = (data) => api.post('/products', data)
export const refreshRecall = () => api.post('/products/refresh')
export const deleteProduct = (id) => api.delete(`/products/${id}`)
