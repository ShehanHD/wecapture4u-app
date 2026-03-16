import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, User } from 'lucide-react'
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
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const NAV_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/clients', label: 'Clients' },
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
          className="relative text-zinc-400 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-[#1a1a1a] border-zinc-800 p-0"
        align="end"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-white">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-amber-500 hover:text-amber-400"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="divide-y divide-zinc-800">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No notifications</p>
          ) : (
            recent.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3',
                  !n.read && 'bg-zinc-900'
                )}
              >
                <p className={cn('text-sm', n.read ? 'text-zinc-400' : 'text-white')}>{n.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-zinc-800">
          <Link
            to="/admin/notifications"
            className="text-xs text-amber-500 hover:text-amber-400"
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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0c0c0c]">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-6 px-4">
          {/* Logo */}
          <Link to="/admin" className="text-lg font-semibold text-amber-500 shrink-0">
            weCapture4U
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side: Bell + Avatar */}
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 text-zinc-400 hover:text-white">
                  <Avatar className="h-7 w-7">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
                    <AvatarFallback className="bg-zinc-700 text-xs text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-[#1a1a1a] border-zinc-800 text-white"
              >
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-zinc-800">
                  <Link to="/admin/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-400 hover:bg-zinc-800 hover:text-red-300 focus:text-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
