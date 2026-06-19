import axios from 'axios'

// ─── Base API client ──────────────────────────────────────────────────────────
// In development: VITE_API_BASE_URL is not set, so falls back to '/api/v1'
// which is proxied to localhost:8000 by vite.config.js.
// In production: VITE_API_BASE_URL = 'http://<ec2-ip>/api/v1' (set in Vercel env vars)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request interceptor — auto-attach JWT token ──────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor — handle 401 → redirect to login ───────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
