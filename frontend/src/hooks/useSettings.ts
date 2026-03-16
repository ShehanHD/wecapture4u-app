import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchSettings, updateSettings,
  fetchSessionTypes, createSessionType, updateSessionType, deleteSessionType,
} from '@/api/settings'

export function useAppSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })
}

export function useSessionTypes() {
  return useQuery({
    queryKey: ['session-types'],
    queryFn: fetchSessionTypes,
  })
}

export function useCreateSessionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createSessionType(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-types'] })
      toast.success('Session type created')
    },
    onError: () => toast.error('Failed to create session type'),
  })
}

export function useUpdateSessionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateSessionType(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-types'] })
      toast.success('Session type updated')
    },
    onError: () => toast.error('Failed to update session type'),
  })
}

export function useDeleteSessionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSessionType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-types'] })
      toast.success('Session type deleted')
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Cannot delete — session type is in use'
      toast.error(msg)
    },
  })
}
