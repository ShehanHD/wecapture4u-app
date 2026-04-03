import { Navigate, Outlet } from 'react-router-dom'
import { auth } from '@/lib/auth'

export function AdminRoute() {
  const token = auth.getAccessToken()
  const role = auth.getRole()

  if (!token || role !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }

  return <Outlet />
}
