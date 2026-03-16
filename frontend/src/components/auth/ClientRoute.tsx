import { Navigate, Outlet } from 'react-router-dom'
import { auth } from '@/lib/auth'

export function ClientRoute() {
  const token = auth.getAccessToken()
  const role = auth.getRole()

  if (!token || role !== 'client') {
    return <Navigate to="/client/login" replace />
  }

  return <Outlet />
}
