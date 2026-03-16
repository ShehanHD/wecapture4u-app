import { createBrowserRouter, Navigate } from 'react-router-dom'
import Landing from '@/pages/public/Landing'
import Gallery from '@/pages/public/Gallery'
import AdminLogin from '@/pages/auth/AdminLogin'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { AdminShell } from '@/components/layout/AdminShell'

// Admin pages
import AdminPortfolio from '@/pages/admin/Portfolio'
import { Dashboard } from '@/pages/admin/Dashboard'
import { Appointments } from '@/pages/admin/Appointments'
import { Accounting } from '@/pages/admin/Accounting'

export const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <Landing /> },
  { path: '/portfolio/:slug', element: <Gallery /> },

  // Auth routes
  { path: '/login', element: <AdminLogin /> },
  { path: '/forgot-password', element: <ForgotPassword /> },

  // Protected admin routes — AdminRoute guard → AdminShell layout
  {
    element: <AdminRoute />,
    children: [
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'appointments', element: <Appointments /> },
          { path: 'portfolio', element: <AdminPortfolio /> },
          { path: 'jobs', element: <div className="text-white">Jobs — Plan 6</div> },
          { path: 'jobs/:id', element: <div className="text-white">Job Detail — Plan 6</div> },
          { path: 'clients', element: <div className="text-white">Clients — Plan 6</div> },
          { path: 'clients/:id', element: <div className="text-white">Client Detail — Plan 6</div> },
          { path: 'accounting', element: <Accounting /> },
          { path: 'notifications', element: <div className="text-white">Notifications — Plan 7</div> },
          { path: 'settings', element: <div className="text-white">Settings — Plan 7</div> },
          { path: 'profile', element: <div className="text-white">Profile — Plan 7</div> },
        ],
      },
    ],
  },

  // Redirect root /admin to dashboard
  { path: '*', element: <Navigate to="/login" replace /> },
])
