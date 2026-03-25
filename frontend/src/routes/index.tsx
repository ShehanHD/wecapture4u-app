import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Landing from '@/pages/public/Landing'
import Gallery from '@/pages/public/Gallery'
import AdminLogin from '@/pages/auth/AdminLogin'
import ClientLogin from '@/pages/auth/ClientLogin'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import BiometricSetup from '@/pages/auth/BiometricSetup'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { ClientRoute } from '@/components/auth/ClientRoute'
import { AdminShell } from '@/components/layout/AdminShell'

// Admin pages
import AdminPortfolio from '@/pages/admin/Portfolio'
import { Dashboard } from '@/pages/admin/Dashboard'
import { Appointments } from '@/pages/admin/Appointments'
import { Accounting } from '@/pages/admin/Accounting'
import { Jobs } from '@/pages/admin/Jobs'
import { JobDetail } from '@/pages/admin/JobDetail'
import { Clients } from '@/pages/admin/Clients'
import { ClientDetail } from '@/pages/admin/ClientDetail'
import { Profile } from '@/pages/admin/Profile'
import { Settings } from '@/pages/admin/Settings'

export const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <Landing /> },
  { path: '/portfolio/:slug', element: <Gallery /> },

  // Admin auth routes
  { path: '/login', element: <AdminLogin /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },

  // Client auth routes
  { path: '/client/login', element: <ClientLogin /> },
  { path: '/client/forgot-password', element: <ForgotPassword /> },
  { path: '/client/reset-password', element: <ResetPassword /> },

  // Protected admin routes — AdminRoute guard → AdminShell layout
  {
    element: <AdminRoute />,
    children: [
      // Biometric setup — outside AdminShell (no sidebar during setup)
      { path: '/admin/biometric/setup', element: <BiometricSetup /> },
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'appointments', element: <Appointments /> },
          { path: 'portfolio', element: <AdminPortfolio /> },
          { path: 'jobs', element: <Jobs /> },
          { path: 'jobs/:id', element: <JobDetail /> },
          { path: 'clients', element: <Clients /> },
          { path: 'clients/:id', element: <ClientDetail /> },
          { path: 'accounting', element: <Accounting /> },
          { path: 'notifications', element: <div className="text-white">Notifications — Plan 7</div> },
          { path: 'settings', element: <Settings /> },
          { path: 'profile', element: <Profile /> },
        ],
      },
    ],
  },

  // Protected client routes
  {
    element: <ClientRoute />,
    children: [
      { path: '/client/biometric/setup', element: <BiometricSetup /> },
      // Client portal pages added in client portal plan
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/login" replace /> },
])
