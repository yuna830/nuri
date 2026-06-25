import api from './index'

export const getSchedulesByWelfareWorker = (id) => api.get(`/schedules/welfare-worker/${id}`)
export const getSchedulesByMonth = (welfareWorkerId, year, month) =>
  api.get(`/schedules/welfare-worker/${welfareWorkerId}/month`, { params: { year, month } })
export const createSchedule = (data) => api.post('/schedules', data)
export const updateScheduleStatus = (id, status) =>
  api.patch(`/schedules/${id}/status`, null, { params: { status } })
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`)
