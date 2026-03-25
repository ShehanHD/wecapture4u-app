import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchJobs, fetchJob, createJob, updateJob, deleteJob,
  fetchJobStages, createJobStage, updateJobStage, reorderJobStages, deleteJobStage,
  type JobCreatePayload, type JobUpdatePayload, type StagePositionItem, type JobStageUpdatePayload,
} from '@/api/jobs'
import { getApiErrorMessage } from '@/lib/apiError'

export function useJobs(params?: { stage_id?: string; client_id?: string }) {
  return useQuery({ queryKey: ['jobs', params], queryFn: () => fetchJobs(params) })
}

export function useJob(id: string) {
  return useQuery({ queryKey: ['jobs', id], queryFn: () => fetchJob(id), enabled: !!id })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createJob,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job created') },
    onError: () => toast.error('Failed to create job'),
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: JobUpdatePayload }) => updateJob(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job updated') },
    onError: () => toast.error('Failed to update job'),
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteJob,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job deleted') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Cannot delete — an invoice is linked'))
    },
  })
}

export function useJobStages() {
  return useQuery({ queryKey: ['job-stages'], queryFn: fetchJobStages })
}

export function useReorderJobStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reorderJobStages,
    onMutate: async (newStages: StagePositionItem[]) => {
      await queryClient.cancelQueries({ queryKey: ['job-stages'] })
      const prev = queryClient.getQueryData(['job-stages'])
      queryClient.setQueryData(['job-stages'], (old: unknown) => {
        if (!Array.isArray(old)) return old
        return old.map((s: { id: string; position: number }) => {
          const update = newStages.find(n => n.id === s.id)
          return update ? { ...s, position: update.position } : s
        }).sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      })
      return { prev }
    },
    onError: (_err: unknown, _vars: unknown, context: unknown) => {
      if (context && typeof context === 'object' && 'prev' in context) {
        queryClient.setQueryData(['job-stages'], (context as { prev: unknown }).prev)
      }
      toast.error('Failed to reorder stages')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['job-stages'] }),
  })
}

export function useDeleteJobStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteJobStage,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-stages'] }); toast.success('Stage deleted') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Cannot delete — jobs are assigned to this stage'))
    },
  })
}

export function useCreateJobStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createJobStage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-stages'] })
      toast.success('Stage created')
    },
    onError: () => toast.error('Failed to create stage'),
  })
}

export function useUpdateJobStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: JobStageUpdatePayload }) =>
      updateJobStage(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-stages'] })
      toast.success('Stage saved')
    },
    onError: () => toast.error('Failed to save stage'),
  })
}
