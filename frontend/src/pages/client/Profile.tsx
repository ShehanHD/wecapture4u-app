// frontend/src/pages/client/Profile.tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile, useUpdateMyProfile } from '@/hooks/useClientPortal'

interface ProfileFormValues {
  name: string
  phone: string
}

export function ClientProfile() {
  const { data: profile } = useMyProfile()
  const updateProfile = useUpdateMyProfile()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, reset } = useForm<ProfileFormValues>({
    defaultValues: { name: '', phone: '' },
  })

  useEffect(() => {
    if (profile) {
      reset({ name: profile.name, phone: profile.phone ?? '' })
    }
  }, [profile, reset])

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({
      name: values.name || undefined,
      phone: values.phone || null,
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/client/login')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl bg-card border p-5 space-y-4 max-w-sm">
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            className="mt-1 bg-input border text-foreground"
            {...register('name', { required: true })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Phone</Label>
          <Input
            className="mt-1 bg-input border text-foreground"
            type="tel"
            {...register('phone')}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input
            className="mt-1 bg-input border text-foreground opacity-60"
            value={profile?.email ?? ''}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground mt-1">Contact us to change your email address.</p>
        </div>
        <Button type="submit" disabled={updateProfile.isPending}>
          Save
        </Button>
      </form>

      <div className="pt-2">
        <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </div>
  )
}
