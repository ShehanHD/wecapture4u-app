import { api } from '@/lib/axios'
import {
  JobListSchema, JobSchema, JobDetailSchema, JobStageListSchema, JobStageSchema,
  AlbumStageListSchema, AlbumStageSchema,
  type Job, type JobDetail, type JobStage, type AlbumStage,
} from '@/schemas/jobs'

export type { Job, JobDetail, JobStage, AlbumStage }

export interface JobCreatePayload {
  client_id: string
  stage_id: string
  appointment_id?: string | null
}

export interface JobUpdatePayload {
  stage_id?: string
  delivery_url?: string | null
  album_stage_id?: string | null
}

export interface StagePositionItem { id: string; position: number }

export async function fetchJobs(params?: { stage_id?: string; client_id?: string }): Promise<Job[]> {
  const { data } = await api.get('/api/jobs', { params })
  return JobListSchema.parse(data)
}

export async function fetchJob(id: string): Promise<JobDetail> {
  const { data } = await api.get(`/api/jobs/${id}`)
  return JobDetailSchema.parse(data)
}

export async function createJob(payload: JobCreatePayload): Promise<Job> {
  const { data } = await api.post('/api/jobs', payload)
  return JobSchema.parse(data)
}

export async function updateJob(id: string, payload: JobUpdatePayload): Promise<Job> {
  const { data } = await api.patch(`/api/jobs/${id}`, payload)
  return JobSchema.parse(data)
}

export async function deleteJob(id: string): Promise<void> {
  await api.delete(`/api/jobs/${id}`)
}

export async function fetchJobStages(): Promise<JobStage[]> {
  const { data } = await api.get('/api/job-stages')
  return JobStageListSchema.parse(data)
}

export async function createJobStage(payload: { name: string; color: string; is_terminal?: boolean }): Promise<JobStage> {
  const { data } = await api.post('/api/job-stages', payload)
  return JobStageSchema.parse(data)
}

export async function updateJobStage(id: string, payload: { name?: string; color?: string; is_terminal?: boolean }): Promise<JobStage> {
  const { data } = await api.patch(`/api/job-stages/${id}`, payload)
  return JobStageSchema.parse(data)
}

export async function reorderJobStages(stages: StagePositionItem[]): Promise<JobStage[]> {
  const { data } = await api.patch('/api/job-stages/positions', { stages })
  return JobStageListSchema.parse(data)
}

export async function deleteJobStage(id: string): Promise<void> {
  await api.delete(`/api/job-stages/${id}`)
}

export interface AlbumStageCreatePayload { name: string; color: string; is_terminal?: boolean }
export interface AlbumStageUpdatePayload { name?: string; color?: string; is_terminal?: boolean }
export interface AlbumStagePositionItem { id: string; position: number }

export async function fetchAlbumStages(): Promise<AlbumStage[]> {
  const { data } = await api.get('/api/album-stages')
  return AlbumStageListSchema.parse(data)
}

export async function createAlbumStage(payload: AlbumStageCreatePayload): Promise<AlbumStage> {
  const { data } = await api.post('/api/album-stages', payload)
  return AlbumStageSchema.parse(data)
}

export async function updateAlbumStage(id: string, payload: AlbumStageUpdatePayload): Promise<AlbumStage> {
  const { data } = await api.patch(`/api/album-stages/${id}`, payload)
  return AlbumStageSchema.parse(data)
}

export async function reorderAlbumStages(stages: AlbumStagePositionItem[]): Promise<AlbumStage[]> {
  const { data } = await api.patch('/api/album-stages/positions', { stages })
  return AlbumStageListSchema.parse(data)
}

export async function deleteAlbumStage(id: string): Promise<void> {
  await api.delete(`/api/album-stages/${id}`)
}


