import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/lib/auth'
import apiClient from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'

export function useAuth() {
  const navigate = useNavigate()

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/login', { email, password })
    auth.setTokens(data.access_token, data.refresh_token)
    const role = auth.getRole()
    navigate(role === 'admin' ? '/admin' : '/client')
  }, [navigate])

  const logout = useCallback(async () => {
    const refreshToken = auth.getRefreshToken()
    try {
      if (refreshToken) {
        await apiClient.post('/api/auth/logout', { refresh_token: refreshToken })
      }
    } finally {
      auth.clearTokens()
      queryClient.clear()
      navigate('/login')
    }
  }, [navigate])

  return {
    isAuthenticated: auth.isAuthenticated(),
    role: auth.getRole(),
    login,
    logout,
  }
}
