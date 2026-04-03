// frontend/src/pages/client/Profile.tsx
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera } from 'lucide-react'
import { useMyProfile, useUpdateMyProfile, useChangePassword, useUploadAvatar } from '@/hooks/useClientPortal'

// ── Shared input style ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f8f9ff', border: '1.5px solid #e0e8ff',
  borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#0a0e2e',
  outline: 'none', boxSizing: 'border-box',
}

// ── Edit field dialog ───────────────────────────────────────────────────────
function EditDialog({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,46,0.3)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* On md+: center the dialog */}
      <style>{`@media (min-width: 768px) { .edit-dialog-inner { bottom: auto !important; border-radius: 14px !important; margin: auto; } }`}</style>
      <div
        className="edit-dialog-inner"
        style={{ background: '#ffffff', borderRadius: '20px 20px 0 0', padding: '16px 20px 28px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ width: 36, height: 4, background: '#e0e8ff', borderRadius: 2, margin: '0 auto 4px' }} />
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0a0e2e' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ── Name dialog ─────────────────────────────────────────────────────────────
const nameSchema = z.object({ name: z.string().min(1, 'Name required') })

function EditNameDialog({ open, currentName, onClose }: { open: boolean; currentName: string; onClose: () => void }) {
  const updateProfile = useUpdateMyProfile()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name: currentName } })
  useEffect(() => { if (open) reset({ name: currentName }) }, [open, currentName, reset])

  const onSubmit = async ({ name }: { name: string }) => {
    await updateProfile.mutateAsync({ name })
    onClose()
  }
  return (
    <EditDialog open={open} onClose={onClose} title="Edit Name">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Full Name</label>
          <input style={inputStyle} autoFocus {...register('name')} />
          {errors.name && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} style={{ background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#778899', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </form>
    </EditDialog>
  )
}

// ── Phone dialog ─────────────────────────────────────────────────────────────
const phoneSchema = z.object({ phone: z.string() })

function EditPhoneDialog({ open, currentPhone, onClose }: { open: boolean; currentPhone: string; onClose: () => void }) {
  const updateProfile = useUpdateMyProfile()
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: currentPhone } })
  useEffect(() => { if (open) reset({ phone: currentPhone }) }, [open, currentPhone, reset])

  const onSubmit = async ({ phone }: { phone: string }) => {
    await updateProfile.mutateAsync({ phone: phone || null })
    onClose()
  }
  return (
    <EditDialog open={open} onClose={onClose} title="Edit Phone">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Phone Number</label>
          <input type="tel" style={inputStyle} autoFocus {...register('phone')} />
        </div>
        <button type="submit" disabled={isSubmitting} style={{ background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#778899', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </form>
    </EditDialog>
  )
}

// ── Password dialog ──────────────────────────────────────────────────────────
const pwSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePassword = useChangePassword()
  type PwFields = { current_password: string; new_password: string; confirm: string }
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PwFields>({ resolver: zodResolver(pwSchema) })
  useEffect(() => { if (open) reset() }, [open, reset])

  const onSubmit = async (d: PwFields) => {
    await changePassword.mutateAsync({ current_password: d.current_password, new_password: d.new_password })
    onClose()
  }
  return (
    <EditDialog open={open} onClose={onClose} title="Change Password">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(
          [
            { name: 'current_password', label: 'Current Password' },
            { name: 'new_password', label: 'New Password' },
            { name: 'confirm', label: 'Confirm New Password' },
          ] as const
        ).map(({ name, label }) => (
          <div key={name}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>{label}</label>
            <input type="password" style={inputStyle} autoFocus={name === 'current_password'} {...register(name)} />
            {errors[name] && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{(errors[name] as { message?: string })?.message}</p>}
          </div>
        ))}
        <button type="submit" disabled={isSubmitting} style={{ background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Updating…' : 'Update Password'}
        </button>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#778899', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </form>
    </EditDialog>
  )
}

// ── Row item ─────────────────────────────────────────────────────────────────
function ProfileRow({ label, value, action, onAction, readOnly }: {
  label: string; value: string; action?: string; onAction?: () => void; readOnly?: boolean
}) {
  return (
    <div
      onClick={!readOnly ? onAction : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid #f8f9ff', cursor: readOnly ? 'default' : 'pointer' }}
    >
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: readOnly ? '#b0bfd8' : '#0a0e2e' }}>{value || '—'}</p>
      </div>
      {readOnly ? (
        <span style={{ fontSize: 10, color: '#b0bfd8', fontStyle: 'italic' }}>read-only</span>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#4d79ff' }}>{action}</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
type Dialog = 'name' | 'phone' | 'password' | null

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function ClientProfile() {
  const { data: profile } = useMyProfile()
  const uploadAvatar = useUploadAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [openDialog, setOpenDialog] = useState<Dialog>(null)

  const initials = profile?.name ? getInitials(profile.name) : '?'
  const avatarUrl = profile?.avatar_url ?? null

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAvatar.mutate(file)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>My Profile</h1>

      {/* Avatar + name + email */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 0 4px' }}>
        <div style={{ position: 'relative' }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile?.name}
              style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #e0e8ff' }}
            />
          ) : (
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(77,121,255,0.15), rgba(122,165,255,0.2))', border: '2.5px solid #e0e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#4d79ff' }}>
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#4d79ff', border: '2px solid #f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Camera size={10} color="white" strokeWidth={2.5} />
          </button>
        </div>
        <p style={{ fontSize: 15, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.01em' }}>{profile?.name ?? '—'}</p>
        <p style={{ fontSize: 12, color: '#778899' }}>{profile?.email ?? '—'}</p>
      </div>

      {/* Personal info section */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Personal Info</p>
        <div style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, overflow: 'hidden' }}>
          <ProfileRow label="Full Name" value={profile?.name ?? ''} action="Edit" onAction={() => setOpenDialog('name')} />
          <ProfileRow label="Phone" value={profile?.phone ?? ''} action="Edit" onAction={() => setOpenDialog('phone')} />
          <ProfileRow label="Email" value={profile?.email ?? ''} readOnly />
        </div>
      </div>

      {/* Security section */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Security</p>
        <div style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, overflow: 'hidden' }}>
          <ProfileRow label="Password" value="••••••••" action="Change" onAction={() => setOpenDialog('password')} />
        </div>
      </div>

      {/* Dialogs */}
      <EditNameDialog
        open={openDialog === 'name'}
        currentName={profile?.name ?? ''}
        onClose={() => setOpenDialog(null)}
      />
      <EditPhoneDialog
        open={openDialog === 'phone'}
        currentPhone={profile?.phone ?? ''}
        onClose={() => setOpenDialog(null)}
      />
      <ChangePasswordDialog
        open={openDialog === 'password'}
        onClose={() => setOpenDialog(null)}
      />
    </div>
  )
}
