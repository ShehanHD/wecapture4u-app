import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { auth } from '@/lib/auth'
import apiClient from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'

export function useAuth() {
  const navigate = useNavigate()

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/login', { email, password })
    auth.setTokens(data.access_token, data.refresh_token)
    const role = auth.getRole()
    const dismissed = localStorage.getItem('biometric_setup_dismissed')
    if (!dismissed) {
      navigate(role === 'admin' ? '/admin/biometric/setup' : '/client/biometric/setup')
    } else {
      navigate(role === 'admin' ? '/admin' : '/client')
    }
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

  const loginWithBiometric = useCallback(async (email?: string) => {
    const { data: options } = await apiClient.post('/api/auth/webauthn/authenticate/options', email ? { email } : {})
    const { challenge_id, ...webauthnOptions } = options
    const credential = await startAuthentication(webauthnOptions)
    const { data } = await apiClient.post('/api/auth/webauthn/authenticate/verify', {
      ...(email ? { email } : { challenge_id }),
      ...credential,
    })
    auth.setTokens(data.access_token, data.refresh_token)
    const role = auth.getRole()
    navigate(role === 'admin' ? '/admin' : '/client')
  }, [navigate])

  const registerBiometric = useCallback(async () => {
    const { data: options } = await apiClient.post('/api/auth/webauthn/register/options', {})
    const credential = await startRegistration(options)
    await apiClient.post('/api/auth/webauthn/register/verify', credential)
  }, [])

  return {
    isAuthenticated: auth.isAuthenticated(),
    role: auth.getRole(),
    login,
    logout,
    loginWithBiometric,
    registerBiometric,
  }
}
