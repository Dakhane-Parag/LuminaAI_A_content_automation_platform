import api from './client'

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const postsApi = {
  getAll: (params) => api.get('/posts', { params }),
  getOne: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post('/posts', data),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
}

export const aiApi = {
  generatePost: (data) => api.post('/ai/generate-posts', data),
}

export const imageApi = {
  generateImage: (postId, data) => api.post(`/images/generate-image/${postId}`, data),
}

export const scheduleApi = {
  schedulePost: (postId, data) => api.post(`/schedule/schedule-post/${postId}`, data),
  getScheduled: (params) => api.get('/schedule/my-schedules', { params }),
  cancelSchedule: (scheduleId) => api.delete(`/schedule/cancel/${scheduleId}`),
}

export const analyticsApi = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getPostStats: (params) => api.get('/analytics/posts', { params }),
  getGenerations: (params) => api.get('/analytics/generations', { params }),
  getPublishing: (params) => api.get('/analytics/publishing', { params }),
  getWorkers: (params) => api.get('/analytics/workers', { params }),
  getActivity: (params) => api.get('/analytics/activity', { params }),
}

export const instagramApi = {
  getStatus: () => api.get('/instagram/status'),
  disconnect: () => api.post('/instagram/disconnect'),
}
