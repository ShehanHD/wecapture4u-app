import React, { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Menu, Moon, Sun, User, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme' // reads global theme state for the toggle button
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const NAV_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/portfolio', label: 'Portfolio' },
  { to: '/admin/accounting', label: 'Accounting' },
  { to: '/admin/settings', label: 'Settings' },
]

function NotificationBell() {
  const { data: recent = [] } = useNotifications({ limit: 5 })
  const unreadCount = useUnreadCount()
  const markAllRead = useMarkAllRead()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-black" style={{ background: 'var(--brand-from)' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-popover border p-0"
        align="end"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border">
          <h3 className="text-sm font-medium text-popover-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-brand-solid hover:opacity-70"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            recent.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3',
                  !n.read && 'bg-muted'
                )}
              >
                <p className={cn('text-sm', n.read ? 'text-muted-foreground' : 'text-foreground')}>{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border">
          <Link
            to="/admin/notifications"
            className="text-xs text-brand-solid hover:opacity-70"
          >
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AdminShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation — frosted glass */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-screen-xl items-center gap-6 px-5">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-foreground/50 hover:text-foreground hover:bg-brand-subtle -ml-1"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          {/* Logo */}
          <Link to="/admin" className="text-sm shrink-0 tracking-tight text-brand font-bold">
            weCapture4U
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'bg-brand-subtle text-brand-solid font-semibold'
                      : 'text-foreground/50 hover:text-foreground hover:bg-muted/50'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side: Bell + Theme + Avatar */}
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="text-foreground/50 hover:text-foreground hover:bg-brand-subtle"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 text-foreground/50 hover:text-foreground hover:bg-muted/50">
                  <Avatar className="h-6 w-6">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
                    <AvatarFallback className="bg-muted text-[10px] text-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-popover border text-popover-foreground z-[100]"
              >
                <DropdownMenuItem asChild className="cursor-pointer text-[13px] hover:bg-muted/50 focus:bg-muted/50">
                  <Link to="/admin/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-[13px] text-red-400 hover:bg-muted/50 hover:text-red-300 focus:bg-muted/50 focus:text-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav drawer — overlays content */}
        {mobileOpen && (
          <nav className="md:hidden absolute left-0 right-0 top-full border-t border bg-background/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-0.5 shadow-2xl z-50">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-brand-subtle text-brand-solid font-semibold'
                      : 'text-foreground/50 hover:text-foreground hover:bg-muted/50'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-screen-xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
