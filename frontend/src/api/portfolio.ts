import api from './index'
import {
  HeroPhotoSchema,
  type HeroPhoto,
  CategorySchema,
  type Category,
  CategoryWithPhotosSchema,
  type CategoryWithPhotos,
  PublicSettingsSchema,
  type PublicSettings,
  AboutSettingsSchema,
  type AboutSettings,
  type PositionItem,
} from '../schemas/portfolio'
import { z } from 'zod'

// ─── Public ───────────────────────────────────────────────────────────────────

export const fetchHeroPhotos = async (): Promise<HeroPhoto[]> => {
  const res = await api.get('/portfolio/hero')
  return z.array(HeroPhotoSchema).parse(res.data)
}

export const fetchCategories = async (): Promise<Category[]> => {
  const res = await api.get('/portfolio/categories')
  return z.array(CategorySchema).parse(res.data)
}

export const fetchCategoryBySlug = async (slug: string): Promise<CategoryWithPhotos> => {
  const res = await api.get(`/portfolio/categories/${slug}`)
  return CategoryWithPhotosSchema.parse(res.data)
}

export const fetchPublicSettings = async (): Promise<PublicSettings> => {
  const res = await api.get('/settings/public')
  return PublicSettingsSchema.parse(res.data)
}

export const submitContact = async (data: { name: string; email: string; message: string }): Promise<void> => {
  await api.post('/contact', data)
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const fetchAboutSettings = async (): Promise<AboutSettings> => {
  const res = await api.get('/settings/about')
  return AboutSettingsSchema.parse(res.data)
}

export const updateAboutSettings = async (data: Partial<AboutSettings>): Promise<AboutSettings> => {
  const res = await api.patch('/settings/about', data)
  return AboutSettingsSchema.parse(res.data)
}

export const uploadHeroPhoto = async (file: File): Promise<HeroPhoto> => {
  const form = new FormData()
  form.append('photo', file)
  const res = await api.post('/portfolio/hero', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return HeroPhotoSchema.parse(res.data)
}

export const deleteHeroPhoto = async (id: string): Promise<void> => {
  await api.delete(`/portfolio/hero/${id}`)
}

export const reorderHeroPhotos = async (items: PositionItem[]): Promise<void> => {
  await api.patch('/portfolio/hero/positions', items)
}

export const createCategory = async (name: string, coverFile: File): Promise<Category> => {
  const form = new FormData()
  form.append('name', name)
  form.append('cover', coverFile)
  const res = await api.post('/portfolio/categories', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return CategorySchema.parse(res.data)
}

export const updateCategory = async (
  id: string,
  data: { name?: string; coverFile?: File },
): Promise<Category> => {
  const form = new FormData()
  if (data.name) form.append('name', data.name)
  if (data.coverFile) form.append('cover', data.coverFile)
  const res = await api.patch(`/portfolio/categories/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return CategorySchema.parse(res.data)
}

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete(`/portfolio/categories/${id}`)
}

export const reorderCategories = async (items: PositionItem[]): Promise<void> => {
  await api.patch('/portfolio/categories/positions', items)
}

export const uploadPhotos = async (categoryId: string, files: File[]): Promise<void> => {
  const form = new FormData()
  files.forEach((f) => form.append('photos', f))
  await api.post(`/portfolio/categories/${categoryId}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const deletePhoto = async (photoId: string): Promise<void> => {
  await api.delete(`/portfolio/photos/${photoId}`)
}

export const reorderPhotos = async (categoryId: string, items: PositionItem[]): Promise<void> => {
  await api.patch(`/portfolio/categories/${categoryId}/photos/positions`, items)
}

export const uploadOgImage = async (file: File): Promise<{ og_image_url: string }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await api.post('/settings/og-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const deleteOgImage = async (): Promise<void> => {
  await api.delete('/settings/og-image')
}
