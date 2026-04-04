import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../lib/apiError'
import * as portfolioApi from '../api/portfolio'

// ─── Public ───────────────────────────────────────────────────────────────────

export const useHeroPhotos = () =>
  useQuery({ queryKey: ['hero-photos'], queryFn: portfolioApi.fetchHeroPhotos })

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: portfolioApi.fetchCategories })

export const useCategoryBySlug = (slug: string) =>
  useQuery({
    queryKey: ['category', slug],
    queryFn: () => portfolioApi.fetchCategoryBySlug(slug),
    enabled: !!slug,
  })

export const usePublicSettings = () =>
  useQuery({ queryKey: ['public-settings'], queryFn: portfolioApi.fetchPublicSettings })

export const useSubmitContact = () =>
  useMutation({
    mutationFn: portfolioApi.submitContact,
    onError: (err) => toast.error(getApiErrorMessage(err, 'Something went wrong. Please try again.')),
  })

// ─── Admin ────────────────────────────────────────────────────────────────────

export const useAboutSettings = () =>
  useQuery({ queryKey: ['about-settings'], queryFn: portfolioApi.fetchAboutSettings })

export const useUpdateAboutSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: portfolioApi.updateAboutSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['about-settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      toast.success('Settings saved')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save settings')),
  })
}

export const useUploadHeroPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => portfolioApi.uploadHeroPhoto(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hero-photos'] })
      toast.success('Photo uploaded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  })
}

export const useDeleteHeroPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portfolioApi.deleteHeroPhoto(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hero-photos'] }) },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Delete failed')),
  })
}

export const useCreateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, coverFile }: { name: string; coverFile: File }) =>
      portfolioApi.createCategory(name, coverFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category created')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create category')),
  })
}

export const useDeleteCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portfolioApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Cannot delete category')),
  })
}

export const useUploadPhotos = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, files }: { categoryId: string; files: File[] }) =>
      portfolioApi.uploadPhotos(categoryId, files),
    onSuccess: (_, { categoryId }) => {
      qc.invalidateQueries({ queryKey: ['category-photos', categoryId] })
      toast.success('Photos uploaded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  })
}

export const useDeletePhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portfolioApi.deletePhoto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err) => {
      const e = err as { response?: { status?: number } }
      if (e.response?.status !== 404) {
        toast.error(getApiErrorMessage(err, 'Failed to delete photo. Please try again.'))
      }
    },
  })
}

export const useUploadOgImage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => portfolioApi.uploadOgImage(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['about-settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      toast.success('Social image uploaded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  })
}

export const useDeleteOgImage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: portfolioApi.deleteOgImage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['about-settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      toast.success('Social image removed')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to remove image')),
  })
}
