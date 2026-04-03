import { z } from 'zod'

export const StatItemSchema = z.object({
  value: z.string(),
  accent: z.string(),
  label: z.string(),
})
export type StatItem = z.infer<typeof StatItemSchema>

export const DEFAULT_STATS: StatItem[] = [
  { value: '500', accent: '+', label: 'Sessions completed' },
  { value: '10', accent: '+', label: 'Years of experience' },
  { value: '5', accent: ' ★', label: 'Average client rating' },
  { value: '48', accent: 'h', label: 'Photo delivery time' },
]

// Public
export const HeroPhotoSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  position: z.number(),
})
export type HeroPhoto = z.infer<typeof HeroPhotoSchema>

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  cover_url: z.string().url(),
  position: z.number(),
})
export type Category = z.infer<typeof CategorySchema>

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  position: z.number(),
})
export type Photo = z.infer<typeof PhotoSchema>

export const CategoryWithPhotosSchema = CategorySchema.extend({
  photos: z.array(PhotoSchema).default([]),
})
export type CategoryWithPhotos = z.infer<typeof CategoryWithPhotosSchema>

export const PublicSettingsSchema = z.object({
  tagline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  contact_headline: z.string().nullable().optional(),
  admin_name: z.string().nullable().optional(),
  admin_avatar_url: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  og_image_url: z.string().nullable().optional(),
  stats: z.array(StatItemSchema).optional().default([]),
})
export type PublicSettings = z.infer<typeof PublicSettingsSchema>

export const AboutSettingsSchema = z.object({
  tagline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  contact_headline: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  og_image_url: z.string().nullable().optional(),
  stats: z.array(StatItemSchema).optional().default([]),
})
export type AboutSettings = z.infer<typeof AboutSettingsSchema>

// Contact form
export const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(254),
  phone: z.string().max(30).optional(),
  message: z.string().min(1, 'Message is required').max(5000),
})
export type ContactForm = z.infer<typeof ContactFormSchema>

// Admin operations
export const PositionItemSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().positive(),
})
export type PositionItem = z.infer<typeof PositionItemSchema>
