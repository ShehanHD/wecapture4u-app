import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Button } from '../../components/ui/button'
import {
  useHeroPhotos,
  useUploadHeroPhoto,
  useDeleteHeroPhoto,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useAboutSettings,
  useUpdateAboutSettings,
  useUploadOgImage,
  useDeleteOgImage,
} from '../../hooks/usePortfolio'
import type { Category } from '../../schemas/portfolio'

// ─── Tab 1: Hero Carousel ─────────────────────────────────────────────────────

function HeroTab() {
  const { data: photos = [] } = useHeroPhotos()
  const uploadMutation = useUploadHeroPhoto()
  const deleteMutation = useDeleteHeroPhoto()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-300">Hero Photos ({photos.length}/20)</h3>
        <Button
          size="sm"
          className="bg-amber-500 text-black hover:bg-amber-400"
          disabled={photos.length >= 20}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadMutation.mutate(file)
            e.target.value = ''
          }}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-video">
            <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm('Delete this hero photo?')) deleteMutation.mutate(photo.id)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 2: Categories ────────────────────────────────────────────────────────

function CategoriesTab({ onSelectCategory }: { onSelectCategory: (c: Category) => void }) {
  const { data: categories = [] } = useCategories()
  const createMutation = useCreateCategory()
  const deleteMutation = useDeleteCategory()
  const [newName, setNewName] = useState('')
  const [newCover, setNewCover] = useState<File | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = async () => {
    if (!newName || !newCover) return
    await createMutation.mutateAsync({ name: newName, coverFile: newCover })
    setNewName('')
    setNewCover(null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-400">Name</label>
          <input
            className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white w-48 block"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Cover Photo</label>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 border-white/20 text-white ml-2"
            onClick={() => coverInputRef.current?.click()}
          >
            {newCover ? newCover.name : 'Choose…'}
          </Button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setNewCover(f)
              e.target.value = ''
            }}
          />
        </div>
        <Button
          size="sm"
          className="bg-amber-500 text-black"
          onClick={handleCreate}
          disabled={!newName || !newCover || createMutation.isPending}
        >
          Create
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <img src={cat.cover_url} alt="" className="w-12 h-8 object-cover rounded" />
              <div>
                <p className="text-white">{cat.name}</p>
                <p className="text-xs text-gray-500">/{cat.slug}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-400 text-xs"
                onClick={() => onSelectCategory(cat)}
              >
                Photos
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 text-xs"
                onClick={() => {
                  if (confirm('Delete category?')) deleteMutation.mutate(cat.id)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 3: Category Photos ───────────────────────────────────────────────────

function CategoryPhotosTab() {
  const { data: categories = [] } = useCategories()
  const [selectedCatId, setSelectedCatId] = useState<string>('')
  const selectedCat = categories.find((c) => c.id === selectedCatId)

  return (
    <div className="space-y-4">
      <select
        className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
        value={selectedCatId}
        onChange={(e) => setSelectedCatId(e.target.value)}
      >
        <option value="">Select category…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {selectedCat && (
        <p className="text-gray-400 text-sm">
          Photo management for {selectedCat.name} — available when online.
        </p>
      )}
    </div>
  )
}

// ─── Tab 4: About & Settings ──────────────────────────────────────────────────

function AboutSettingsTab() {
  const { data: settings } = useAboutSettings()
  const updateMutation = useUpdateAboutSettings()
  const uploadOgImageMutation = useUploadOgImage()
  const deleteOgImageMutation = useDeleteOgImage()
  const ogImageInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit } = useForm({
    defaultValues: {
      tagline: settings?.tagline ?? '',
      bio: settings?.bio ?? '',
      instagram_url: settings?.instagram_url ?? '',
      facebook_url: settings?.facebook_url ?? '',
      contact_headline: settings?.contact_headline ?? '',
      contact_email: settings?.contact_email ?? '',
      meta_title: settings?.meta_title ?? '',
      meta_description: settings?.meta_description ?? '',
    },
  })

  return (
    <form
      onSubmit={handleSubmit((data) =>
        updateMutation.mutate(
          Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v || null])),
        ),
      )}
      className="space-y-4 max-w-lg"
    >
      {(
        [
          { name: 'tagline', label: 'Tagline' },
          { name: 'instagram_url', label: 'Instagram URL' },
          { name: 'facebook_url', label: 'Facebook URL' },
          { name: 'contact_headline', label: 'Contact Headline' },
          { name: 'contact_email', label: 'Contact Email' },
          { name: 'meta_title', label: 'Page Title (SEO)' },
        ] as const
      ).map(({ name, label }) => (
        <div key={name}>
          <label className="text-xs text-gray-400">{label}</label>
          <input
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white block"
            {...register(name)}
          />
        </div>
      ))}

      <div>
        <label className="text-xs text-gray-400">Bio</label>
        <textarea
          rows={3}
          className="mt-1 w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none block"
          {...register('bio')}
        />
      </div>

      <div>
        <label className="text-xs text-gray-400">Meta Description (SEO)</label>
        <textarea
          rows={2}
          className="mt-1 w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none block"
          {...register('meta_description')}
        />
      </div>

      {/* og:image */}
      <div>
        <label className="text-xs text-gray-400">Social Sharing Image (1200×630)</label>
        <div className="flex gap-2 mt-1 items-center flex-wrap">
          {settings?.og_image_url && (
            <img
              src={settings.og_image_url}
              alt="OG"
              className="h-16 rounded border border-white/20"
            />
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/20 text-white"
            onClick={() => ogImageInputRef.current?.click()}
          >
            {settings?.og_image_url ? 'Replace' : 'Upload'}
          </Button>
          {settings?.og_image_url && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-400"
              onClick={() => deleteOgImageMutation.mutate()}
            >
              Remove
            </Button>
          )}
          <input
            ref={ogImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadOgImageMutation.mutate(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="bg-amber-500 text-black hover:bg-amber-400"
        disabled={updateMutation.isPending}
      >
        Save
      </Button>
    </form>
  )
}

// ─── Tab 5: Contact Submissions ───────────────────────────────────────────────

function ContactSubmissionsTab() {
  return (
    <div className="text-gray-400 text-sm">
      Contact submissions view — available when backend returns data.
    </div>
  )
}

// ─── Main Portfolio Page ──────────────────────────────────────────────────────

export default function Portfolio() {
  const [, setSelectedCategory] = useState<Category | null>(null)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Portfolio</h1>
      <Tabs defaultValue="hero">
        <TabsList className="mb-6 bg-white/5">
          <TabsTrigger value="hero">Hero Carousel</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="photos">Category Photos</TabsTrigger>
          <TabsTrigger value="about">About & Settings</TabsTrigger>
          <TabsTrigger value="contact">Contact Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="hero">
          <HeroTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab onSelectCategory={(c) => setSelectedCategory(c)} />
        </TabsContent>
        <TabsContent value="photos">
          <CategoryPhotosTab />
        </TabsContent>
        <TabsContent value="about">
          <AboutSettingsTab />
        </TabsContent>
        <TabsContent value="contact">
          <ContactSubmissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
