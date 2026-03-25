// frontend/src/pages/admin/Profile.tsx
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fingerprint, Trash2, Camera, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
  useUploadAvatar,
  useCredentials,
  useDeleteCredential,
} from '@/hooks/useProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// --- Schemas ---
const identitySchema = z.object({
  full_name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
  current_password: z.string().optional(),
})
type IdentityForm = z.infer<typeof identitySchema>

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Required'),
    new_password: z.string().min(8, 'At least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
type PasswordForm = z.infer<typeof passwordSchema>

// --- Identity section ---
function IdentitySection() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const fileRef = useRef<HTMLInputElement>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    values: {
      full_name: profile?.full_name ?? '',
      email: profile?.email ?? '',
      current_password: '',
    },
  })

  const currentEmail = watch('email')
  const emailChanged = currentEmail !== profile?.email

  const onSubmit = async (data: IdentityForm) => {
    const payload: Parameters<typeof updateProfile.mutateAsync>[0] = {}
    if (data.full_name !== profile?.full_name) payload.full_name = data.full_name
    if (data.email !== profile?.email) {
      payload.email = data.email
      payload.current_password = data.current_password
    }
    if (Object.keys(payload).length === 0) return
    await updateProfile.mutateAsync(payload)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAvatar.mutateAsync(file)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <h2 className="text-base font-semibold text-foreground">Profile</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-muted-foreground" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-full">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <div>
          <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
          <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input {...register('full_name')} />
          {errors.full_name && (
            <p className="text-destructive text-sm">{errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" {...register('email')} />
          {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
        </div>

        {emailChanged && (
          <div className="space-y-1.5">
            <Label>
              Current Password{' '}
              <span className="text-muted-foreground">(required to change email)</span>
            </Label>
            <Input type="password" {...register('current_password')} />
            {errors.current_password && (
              <p className="text-destructive text-sm">{errors.current_password.message}</p>
            )}
          </div>
        )}

        {updateProfile.error && (
          <p className="text-destructive text-sm">
            {(updateProfile.error as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? 'Update failed'}
          </p>
        )}
        {success && <p className="text-green-500 text-sm">Saved.</p>}

        <Button
          type="submit"
          className="rounded-xl"
          disabled={isSubmitting || updateProfile.isPending}
        >
          {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </div>
  )
}

// --- Password section ---
function PasswordSection() {
  const changePassword = useChangePassword()
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordForm) => {
    await changePassword.mutateAsync({
      current_password: data.current_password,
      new_password: data.new_password,
    })
    reset()
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-foreground">Change Password</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Current Password</Label>
          <Input type="password" {...register('current_password')} />
          {errors.current_password && (
            <p className="text-destructive text-sm">{errors.current_password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>New Password</Label>
          <Input type="password" {...register('new_password')} />
          {errors.new_password && (
            <p className="text-destructive text-sm">{errors.new_password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Confirm New Password</Label>
          <Input type="password" {...register('confirm_password')} />
          {errors.confirm_password && (
            <p className="text-destructive text-sm">{errors.confirm_password.message}</p>
          )}
        </div>

        {changePassword.error && (
          <p className="text-destructive text-sm">
            {(changePassword.error as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? 'Failed to change password'}
          </p>
        )}
        {success && <p className="text-green-500 text-sm">Password updated.</p>}

        <Button
          type="submit"
          className="rounded-xl"
          disabled={isSubmitting || changePassword.isPending}
        >
          {changePassword.isPending ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </div>
  )
}

// --- Devices section ---
function DevicesSection() {
  const { data: credentials, isLoading } = useCredentials()
  const deleteCredential = useDeleteCredential()

  if (isLoading) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-foreground">Biometric Devices</h2>
      <p className="text-sm text-muted-foreground">Devices registered for passwordless login.</p>

      {!credentials?.length ? (
        <div className="flex items-center gap-3 py-4 text-muted-foreground">
          <Fingerprint className="w-5 h-5" />
          <span className="text-sm">No biometric devices registered.</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {credentials.map((cred) => (
            <li
              key={cred.credential_id}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <Fingerprint className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {cred.device_name ?? 'Unknown device'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {formatDistanceToNow(new Date(cred.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteCredential.mutate(cred.credential_id)}
                disabled={deleteCredential.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// --- Page ---
export function Profile() {
  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>
      <IdentitySection />
      <PasswordSection />
      <DevicesSection />
    </div>
  )
}
