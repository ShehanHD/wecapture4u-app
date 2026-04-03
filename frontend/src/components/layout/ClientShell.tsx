// frontend/src/components/layout/ClientShell.tsx
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, CalendarPlus, ChevronLeft, ChevronRight,
  LayoutDashboard, LogOut, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile, useUnreadNotificationCount } from '@/hooks/useClientPortal'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/client', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/client/book', label: 'Booking', icon: CalendarPlus },
  { to: '/client/notifications', label: 'Notifications', icon: Bell },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ClientShell() {
  const { logout } = useAuth()
  const { data: profile } = useMyProfile()
  const unreadCount = useUnreadNotificationCount()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('client-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('client-sidebar-collapsed', String(next)) } catch { /* noop */ }
      return next
    })
  }

  const handleLogout = () => setShowLogoutConfirm(true)

  const initials = profile?.name ? getInitials(profile.name) : '?'
  const avatarUrl = profile?.avatar_url ?? null

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9ff' }}>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen border-r"
        style={{
          width: collapsed ? 56 : 200,
          background: '#ffffff',
          borderColor: '#e0e8ff',
          transition: 'width 220ms ease',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 border-b flex-shrink-0"
          style={{ padding: collapsed ? '14px 0' : '14px 14px', borderColor: '#e0e8ff', justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          <div
            className="flex-shrink-0 rounded-[7px]"
            style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)' }}
          />
          {!collapsed && (
            <span className="text-[13px] font-[800] tracking-tight" style={{ color: '#0a0e2e' }}>
              weCapture4U
            </span>
          )}
        </div>

        {/* User card */}
        <div
          className={cn('border-b flex-shrink-0 cursor-pointer', collapsed ? 'flex justify-center py-3' : 'flex flex-col items-center gap-1.5 py-4 px-3')}
          style={{ borderColor: '#e0e8ff' }}
          onClick={() => navigate('/client/profile')}
        >
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile?.name}
                className="rounded-full object-cover"
                style={{ width: collapsed ? 34 : 52, height: collapsed ? 34 : 52, border: '2px solid #e0e8ff' }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-[800]"
                style={{
                  width: collapsed ? 34 : 52,
                  height: collapsed ? 34 : 52,
                  background: 'linear-gradient(135deg, rgba(77,121,255,0.15), rgba(122,165,255,0.2))',
                  border: '2px solid #e0e8ff',
                  color: '#4d79ff',
                  fontSize: collapsed ? 11 : 16,
                }}
              >
                {initials}
              </div>
            )}
            {/* Pencil dot when collapsed */}
            {collapsed && (
              <div
                className="absolute bottom-0 right-0 rounded-full flex items-center justify-center"
                style={{ width: 14, height: 14, background: '#4d79ff', border: '2px solid #fff' }}
              />
            )}
          </div>
          {!collapsed && (
            <>
              <span className="text-[13px] font-[700] text-center" style={{ color: '#0a0e2e' }}>
                {profile?.name ?? '—'}
              </span>
              <span className="text-[10px] font-[600]" style={{ color: '#4d79ff' }}>
                Edit profile →
              </span>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto" style={{ padding: collapsed ? '10px 0' : '10px 8px' }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-[8px] transition-colors',
                  collapsed ? 'justify-center mx-auto' : 'gap-2.5 px-[10px]',
                  isActive
                    ? 'bg-[#f0f4ff] text-[#4d79ff]'
                    : 'text-[#778899] hover:bg-[#f8f9ff]',
                )
              }
              style={{ height: 38, width: collapsed ? 40 : 'auto' }}
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex-shrink-0">
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span
                        className="absolute rounded-full"
                        style={{ top: -3, right: -3, width: 7, height: 7, background: '#e05252', border: '1.5px solid #fff' }}
                      />
                    )}
                  </div>
                  {!collapsed && (
                    <span className={cn('text-[13px]', isActive ? 'font-[600]' : 'font-[500]')}>
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* Logout — pushed to bottom */}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center rounded-[8px] mt-auto transition-colors hover:bg-[#fff5f5]',
              collapsed ? 'justify-center mx-auto' : 'gap-2.5 px-[10px]',
            )}
            style={{ height: 38, width: collapsed ? 40 : 'auto', color: '#e05252', marginTop: 'auto' }}
          >
            <LogOut size={16} strokeWidth={2} />
            {!collapsed && <span className="text-[13px] font-[500]">Log out</span>}
          </button>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center border-t flex-shrink-0 hover:bg-[#f8f9ff] transition-colors"
          style={{ height: 36, borderColor: '#e0e8ff', color: '#778899' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="md:hidden flex items-center justify-between border-b flex-shrink-0 px-4"
          style={{ height: 48, background: '#ffffff', borderColor: '#e0e8ff' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="rounded-[6px] flex-shrink-0"
              style={{ width: 22, height: 22, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)' }}
            />
            <span className="text-[13px] font-[800] tracking-tight" style={{ color: '#0a0e2e' }}>
              weCapture4U
            </span>
          </div>
          <button onClick={() => navigate('/client/profile')} className="rounded-full overflow-hidden" style={{ width: 28, height: 28 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile?.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-[700] text-[10px] rounded-full"
                style={{ background: '#f0f4ff', border: '1.5px solid #4d79ff', color: '#4d79ff' }}
              >
                {initials}
              </div>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="mx-auto max-w-2xl px-4 py-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-10"
          style={{ height: 62, background: '#ffffff', borderColor: '#e0e8ff' }}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-[500] transition-colors pt-2',
                  isActive ? 'text-[#4d79ff] font-[600]' : 'text-[#b0bfd8]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span
                        className="absolute rounded-full"
                        style={{ top: -2, right: -2, width: 7, height: 7, background: '#e05252', border: '1.5px solid #fff' }}
                      />
                    )}
                  </div>
                  {label === 'Notifications' ? 'Alerts' : label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-[500] transition-colors pt-2"
            style={{ color: '#e05252' }}
          >
            <LogOut size={20} strokeWidth={1.8} />
            Log out
          </button>
        </nav>
      </div>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,46,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogoutConfirm(false) }}
        >
          <div style={{ background: '#ffffff', borderRadius: 14, padding: '24px 24px 20px', width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0e2e' }}>Log out?</p>
            <p style={{ fontSize: 13, color: '#778899', marginBottom: 8 }}>You'll need to sign in again to access your account.</p>
            <button
              onClick={() => logout()}
              style={{ width: '100%', background: '#e05252', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer' }}
            >
              Log out
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              style={{ width: '100%', background: 'none', border: '1px solid #e0e8ff', color: '#778899', fontWeight: 600, fontSize: 14, padding: '11px', borderRadius: 9, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
