import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fingerprint } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const DISMISSED_KEY = 'biometric_setup_dismissed'

export default function BiometricSetup() {
  const navigate = useNavigate()
  const { registerBiometric } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const role = auth.getRole()
  const redirectPath = role === 'admin' ? '/admin' : '/client'

  const handleEnable = async () => {
    setError(null)
    setIsLoading(true)
    try {
      await registerBiometric()
      navigate(redirectPath)
    } catch {
      setError('Biometric setup failed. Please try again or skip for now.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    navigate(redirectPath)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Fingerprint className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground mb-2">Enable Biometric Login</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Use Face ID or fingerprint for faster, passwordless login on this device.
        </p>

        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        <div className="space-y-3">
          <Button className="w-full h-10 rounded-xl" onClick={handleEnable} disabled={isLoading}>
            {isLoading ? 'Setting up…' : 'Enable Face ID / Fingerprint'}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-10 rounded-xl text-muted-foreground"
            onClick={handleSkip}
            disabled={isLoading}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}
