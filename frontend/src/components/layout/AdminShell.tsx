import React, { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart2, Bell, Briefcase, CalendarDays, ChevronLeft, ChevronRight,
  Image, Inbox, LayoutDashboard, LogOut, Menu, Moon, Settings2, Sun, User, Users, X,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

type NavItem = { to: string; label: string; icon: React.ElementType; end?: boolean }

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Workspace',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/appointments', label: 'Appointments', icon: CalendarDays },
      { to: '/admin/jobs', label: 'Jobs', icon: Briefcase },
      { to: '/admin/clients', label: 'Clients', icon: Users },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/accounting', label: 'Accounting', icon: BarChart2 },
      { to: '/admin/inbox', label: 'Inbox', icon: Inbox },
    ],
  },
  {
    label: 'Studio',
    items: [
      { to: '/admin/portfolio', label: 'Portfolio', icon: Image },
      { to: '/admin/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { data: recent = [] } = useNotifications({ limit: 5 })
  const unreadCount = useUnreadCount()
  const markAllRead = useMarkAllRead()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8 flex-shrink-0"
          aria-label="Notifications"
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-black" style={{ background: 'var(--brand-from)' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border p-0" side="right" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border">
          <h3 className="text-sm font-medium text-popover-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={() => markAllRead.mutate()} className="text-xs text-brand-solid hover:opacity-70">
              Mark all read
            </button>
          )}
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            recent.map((n) => (
              <div key={n.id} className={cn('px-4 py-3', !n.read && 'bg-muted')}>
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
          <Link to="/admin/notifications" className="text-xs text-brand-solid hover:opacity-70">
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SidebarContent({
  collapsed,
  onToggleCollapsed,
  onNavClick,
  showToggle = true,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  onNavClick?: () => void
  showToggle?: boolean
}) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = 'A'

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-2 mb-5', collapsed ? 'justify-center' : 'px-2')}>
        <Link to="/admin" onClick={onNavClick} title={collapsed ? 'weCapture4U' : undefined}>
          <div className="w-7 h-7 rounded-[7px] bg-foreground flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </Link>
        {!collapsed && (
          <Link to="/admin" onClick={onNavClick} className="text-[14px] font-semibold tracking-tight text-foreground">
            weCapture4U
          </Link>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_SECTIONS.map((section) => (
          <React.Fragment key={section.label}>
            {collapsed
              ? <div className="pt-2" />
              : (
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 px-2 pt-3 pb-1">
                  {section.label}
                </span>
              )
            }
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavClick}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg text-[13.5px] transition-all duration-100',
                    collapsed ? 'justify-center py-2 h-9 gap-0' : 'gap-2.5 px-2 py-[7px]',
                    isActive
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )
                }
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* Bottom: notifications + theme + user + collapse toggle */}
      <div className="mt-4 pt-4 border-t border-border flex flex-col gap-1">
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : 'flex-row items-center px-1')}>
          <NotificationBell collapsed={collapsed} />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8 flex-shrink-0"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title={collapsed ? 'Admin' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg w-full hover:bg-muted/50 transition-colors',
                collapsed ? 'justify-center py-2' : 'px-2 py-2 text-left'
              )}
            >
              <Avatar className="h-6 w-6 flex-shrink-0">

                <AvatarFallback className="bg-muted text-[10px] text-foreground">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <span className="text-[13px] text-foreground/70 truncate flex-1">Admin</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? 'right' : 'top'}
            align="start"
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

        {showToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8 self-center mt-0.5"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

export function AdminShell() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [location.pathname, queryClient])

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar — fixed, width transitions */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 bg-background border-r border-border py-6 z-30 transition-all duration-200 overflow-hidden"
        style={{ width: collapsed ? 64 : 220, padding: collapsed ? '24px 0' : '24px 12px' }}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile: backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile: slide-in sidebar (always expanded, no collapse toggle) */}
      {mobileOpen && (
        <aside className="md:hidden fixed inset-y-0 left-0 w-[220px] bg-background border-r border-border px-3 py-6 z-50 flex flex-col">
          <SidebarContent
            collapsed={false}
            onToggleCollapsed={() => {}}
            onNavClick={() => setMobileOpen(false)}
            showToggle={false}
          />
        </aside>
      )}

      {/* Main content — left padding mirrors sidebar width on desktop */}
      <div
        className={cn(
          'flex-1 min-h-screen flex flex-col transition-all duration-200',
          collapsed ? 'md:pl-16' : 'md:pl-[220px]'
        )}
      >
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center h-12 px-4 border-b border-border bg-background/80 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground/50 hover:text-foreground -ml-1"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <Link to="/admin" className="ml-3 text-sm font-bold tracking-tight text-foreground">
            weCapture4U
          </Link>
        </header>

        <main className="flex-1 px-5 py-8 max-w-screen-xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
