import { createBrowserRouter } from 'react-router-dom'
import Landing from '../pages/public/Landing'
import Gallery from '../pages/public/Gallery'
import AdminPortfolio from '../pages/admin/Portfolio'
import { AdminRoute } from '../components/auth/AdminRoute'

export const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <Landing /> },
  { path: '/portfolio/:slug', element: <Gallery /> },

  // Admin routes
  {
    element: <AdminRoute />,
    children: [
      { path: '/admin/portfolio', element: <AdminPortfolio /> },
    ],
  },
])
