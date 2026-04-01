import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Briefcase, CalendarPlus, Home, LogOut, User, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile } from '@/hooks/useClientPortal'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const TABS: Tab[] = [
  { to: '/client', label: 'Home', icon: Home, end: true },
  { to: '/client/jobs', label: 'My Jobs', icon: Briefcase },
  { to: '/client/book', label: 'Book', icon: CalendarPlus },
  { to: '/client/profile', label: 'Profile', icon: User },
]

export function ClientShell() {
  const { logout } = useAuth()
  const { data: profile } = useMyProfile()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/client/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Desktop top nav — hidden on mobile */}
      <header className="hidden md:flex sticky top-0 z-10 h-14 items-center justify-between border-b bg-card px-6">
        <span className="text-sm font-semibold text-foreground">weCapture4U</span>
        <nav className="flex items-center gap-6">
          {TABS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('text-sm font-medium transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.name}</span>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Page content — bottom padding on mobile to clear the tab bar */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-16 items-stretch border-t bg-card md:hidden">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
