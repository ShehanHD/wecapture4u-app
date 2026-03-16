import axios, { type AxiosInstance } from 'axios'
import { auth } from '@/lib/auth'

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = auth.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: attempt token refresh, retry original request once
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const refreshToken = auth.getRefreshToken()
    if (!refreshToken) {
      auth.clearTokens()
      redirectToLogin()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(apiClient(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
        { refresh_token: refreshToken },
      )
      auth.setTokens(data.access_token, data.refresh_token)
      refreshQueue.forEach((cb) => cb(data.access_token))
      refreshQueue = []
      original.headers.Authorization = `Bearer ${data.access_token}`
      return apiClient(original)
    } catch {
      auth.clearTokens()
      redirectToLogin()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

function redirectToLogin(): void {
  const role = auth.getRole()
  window.location.href = role === 'client' ? '/client/login' : '/login'
}

export default apiClient
