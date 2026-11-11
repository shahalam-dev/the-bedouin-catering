import { z } from 'zod'

// HTML forms send "" for empty fields; treat those as "not given" (null).
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blank, schema.optional()).transform((v) => v ?? null)

const id = z.coerce.number().int().positive()

/** Today's date (YYYY-MM-DD) in Malaysia, so "today" does not flip at 8am local time. */
export const todayInMalaysia = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,19}$/),
  email: optional(z.email().max(200)),
  event_date: optional(z.iso.date().refine((d) => d >= todayInMalaysia())),
  pax: optional(z.coerce.number().int().min(1).max(10_000)),
  branch_id: optional(id),
  cuisine_id: optional(id),
  package_id: optional(id),
  message: optional(z.string().trim().max(2000)),
  'cf-turnstile-response': z.string().default(''),
})

export type EnquiryForm = z.infer<typeof enquirySchema>
export type EnquiryField = Exclude<keyof EnquiryForm, 'cf-turnstile-response'>

// ---- Admin CMS ----

const status = z.enum(['published', 'draft', 'hidden'])
const name = z.string().trim().min(1).max(120)
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
const text = (max: number) => optional(z.string().trim().max(max))
const sortOrder = z.preprocess(blank, z.coerce.number().int().min(0).max(9999).default(0))
// Unchecked checkboxes are not sent at all.
const checkbox = z.preprocess((v) => v === 'on', z.boolean())

/** "35" or "35.50" (RM) -> integer sen. Parsed as text so 0.1 + 0.2 style float errors cannot creep in. */
export function rmToSen(rm: string): number {
  const [whole, frac = ''] = rm.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}
const price = z.string().trim().regex(/^\d{1,6}(?:\.\d{1,2})?$/).transform(rmToSen)

/** Textarea, one item per line. */
const lines = z
  .string()
  .transform((s) => s.split('\n').map((l) => l.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(200)).max(20))

const common = { name, sort_order: sortOrder, status, image_id: optional(id) }

export const occasionSchema = z.object({ ...common, slug, description: text(1000) })

export const packageSchema = z.object({
  ...common,
  slug,
  branch_id: id,
  cuisine_id: id,
  description: text(1000),
  price_sen: price,
  min_pax: z.coerce.number().int().min(1).max(10_000),
  inclusions: lines,
  is_popular: checkbox,
})

export const menuItemSchema = z.object({
  ...common,
  cuisine_id: optional(id),
  description: text(1000),
  category: text(60),
  price_sen: optional(price),
  is_bestseller: checkbox,
})

export const enquiryStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'closed']),
  // Which list filter to go back to.
  filter: optional(z.enum(['new', 'contacted', 'closed'])),
})

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
// Uploads are re-encoded to WebP. No SVG (it can carry scripts); no AVIF (Cloudflare Images
// only reads AVIF on Enterprise plans).
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const
// Some browsers (e.g. Chrome on Windows) send HEIC files with an empty type.
const uploadType = (f: File) => f.type || (/\.hei[cf]$/i.test(f.name) ? 'image/heic' : '')

const imageFile = z
  .instanceof(File)
  .refine((f) => (IMAGE_TYPES as readonly string[]).includes(uploadType(f)) && f.size > 0 && f.size <= MAX_UPLOAD_BYTES)
const alt = z.string().trim().min(3).max(300)

export const mediaUploadSchema = z.object({
  folder: z.enum(['packages', 'menu', 'gallery', 'cuisines', 'branches']),
  alt,
  file: imageFile,
})

// Forms with an optional image upload (cuisines, branches): a sent file becomes the image
// (stored in that section's media folder) and needs alt text; otherwise image_id picks from the library.
const imageUpload = {
  // An empty file input arrives as "" (or a nameless, empty File): no upload.
  image_file: z.preprocess((v) => (v === '' || (v instanceof File && v.size === 0 && !v.name) ? undefined : v), imageFile.optional()).transform((v) => v ?? null),
  image_alt: z.string().trim().default(''),
}
const altNeeded = (v: { image_file: File | null; image_alt: string }) => !v.image_file || alt.safeParse(v.image_alt).success

export const cuisineSchema = z
  .object({ ...common, ...imageUpload, slug, name_bm: text(120), description: text(1000), description_bm: text(1000) })
  .refine(altNeeded, { path: ['image_alt'] })

export const branchSchema = z
  .object({ ...common, ...imageUpload, slug, name_bm: text(120), address: text(300), phone: text(30) })
  .refine(altNeeded, { path: ['image_alt'] })
