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

export const branchSchema = z.object({
  ...common,
  slug,
  address: text(300),
  phone: text(30),
})

export const cuisineSchema = z.object({ ...common, slug, description: text(1000) })

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

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
// No SVG: it can carry scripts.
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' } as const

export const mediaUploadSchema = z.object({
  folder: z.enum(['packages', 'menu', 'gallery']),
  alt: z.string().trim().min(3).max(300),
  file: z
    .instanceof(File)
    .refine((f) => f.type in IMAGE_TYPES && f.size > 0 && f.size <= MAX_UPLOAD_BYTES),
})
