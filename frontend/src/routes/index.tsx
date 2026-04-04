import { createBrowserRouter } from 'react-router-dom'
import Landing from '@/pages/public/Landing'
import NotFound from '@/pages/public/NotFound'
import Gallery from '@/pages/public/Gallery'
import AdminLogin from '@/pages/auth/AdminLogin'
import ClientLogin from '@/pages/auth/ClientLogin'
import ClientRegister from '@/pages/auth/ClientRegister'
import VerifyEmail from '@/pages/auth/VerifyEmail'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import BiometricSetup from '@/pages/auth/BiometricSetup'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { ClientRoute } from '@/components/auth/ClientRoute'
import { AdminShell } from '@/components/layout/AdminShell'
import { ClientShell } from '@/components/layout/ClientShell'

// Client portal pages
import { ClientHome } from '@/pages/client/Home'
import { ClientBooking } from '@/pages/client/Booking'
import { ClientNotifications } from '@/pages/client/Notifications'
import { ClientJobDetail } from '@/pages/client/JobDetail'
import { ClientProfile } from '@/pages/client/Profile'

// Admin pages
import AdminPortfolio from '@/pages/admin/Portfolio'
import { Dashboard } from '@/pages/admin/Dashboard'
import { Appointments } from '@/pages/admin/Appointments'
import { Accounting } from '@/pages/admin/Accounting'
import { Jobs } from '@/pages/admin/Jobs'
import { AlbumJobs } from '@/pages/admin/AlbumJobs'
import { JobDetail } from '@/pages/admin/JobDetail'
import { Clients } from '@/pages/admin/Clients'
import { ClientDetail } from '@/pages/admin/ClientDetail'
import { Profile } from '@/pages/admin/Profile'
import { Notifications } from '@/pages/admin/Notifications'
import { Settings } from '@/pages/admin/Settings'
import { Inbox } from '@/pages/admin/Inbox'

export const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <Landing /> },
  { path: '/portfolio/:slug', element: <Gallery /> },

  // Admin auth routes
  { path: '/login', element: <AdminLogin /> },
  { path: '/admin/login', element: <AdminLogin /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },

  // Client auth routes
  { path: '/client/login', element: <ClientLogin /> },
  { path: '/client/register', element: <ClientRegister /> },
  { path: '/client/verify-email', element: <VerifyEmail /> },
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
          { path: 'albums', element: <AlbumJobs /> },
          { path: 'clients', element: <Clients /> },
          { path: 'clients/:id', element: <ClientDetail /> },
          { path: 'accounting', element: <Accounting /> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'settings', element: <Settings /> },
          { path: 'profile', element: <Profile /> },
          { path: 'inbox', element: <Inbox /> },
        ],
      },
    ],
  },

  // Protected client routes — ClientRoute guard → ClientShell layout
  {
    element: <ClientRoute />,
    children: [
      { path: '/client/biometric/setup', element: <BiometricSetup /> },
      {
        path: '/client',
        element: <ClientShell />,
        children: [
          { index: true, element: <ClientHome /> },
          { path: 'jobs/:id', element: <ClientJobDetail /> },
          { path: 'book', element: <ClientBooking /> },
          { path: 'notifications', element: <ClientNotifications /> },
          { path: 'profile', element: <ClientProfile /> },
          { path: 'biometric/setup', element: <BiometricSetup /> },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <NotFound /> },
])
