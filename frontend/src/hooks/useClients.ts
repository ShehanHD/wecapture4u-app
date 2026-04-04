import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchClients, fetchClient, createClient, updateClient, deleteClient,
  createPortalAccess, togglePortalAccess,
  type ClientCreatePayload,
} from '@/api/clients'
import { getApiErrorMessage } from '@/lib/apiError'

export function useClients(params?: { search?: string; tag?: string }) {
  return useQuery({ queryKey: ['clients', params], queryFn: () => fetchClients(params) })
}

export function useClient(id: string) {
  return useQuery({ queryKey: ['clients', id], queryFn: () => fetchClient(id), enabled: !!id })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client created') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to create client'))
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, { id: string; payload: Partial<ClientCreatePayload> }>({
    mutationFn: ({ id, payload }) => updateClient(id, payload),
    onSuccess: (_data: unknown, { id }: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Client updated')
    },
    onError: () => toast.error('Failed to update client'),
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client deleted') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Cannot delete — client has jobs or invoices'))
    },
  })
}

export function useTogglePortalAccess() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, { id: string; is_active: boolean }>({
    mutationFn: ({ id, is_active }) => togglePortalAccess(id, is_active),
    onSuccess: (_data: unknown, { id }: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Portal access updated')
    },
    onError: () => toast.error('Failed to update portal access'),
  })
}

export function useCreatePortalAccess() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, { id: string; temp_password: string }>({
    mutationFn: ({ id, temp_password }) => createPortalAccess(id, temp_password),
    onSuccess: (_data: unknown, { id }: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Portal account created — credentials sent by email')
    },
    onError: () => toast.error('Failed to create portal account'),
  })
}
