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
  message: optional(z.string().trim().max(2000)),
  'cf-turnstile-response': z.string().default(''),
})

export type EnquiryForm = z.infer<typeof enquirySchema>
export type EnquiryField = Exclude<keyof EnquiryForm, 'cf-turnstile-response'>

// ---- Package selector booking (step 5) ----
// service, cuisine and package are slugs carried from the earlier steps; the route
// re-checks them against the database. Menu choices (g<groupId>) are read by checkMenuChoices.

const bookingCommon = {
  cuisine: z.string().max(80),
  package: z.string().max(80),
  name: enquirySchema.shape.name,
  phone: enquirySchema.shape.phone,
  email: enquirySchema.shape.email,
  event_date: z.iso.date().refine((d) => d >= todayInMalaysia()),
  event_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pax: z.coerce.number().int().min(1).max(10_000),
  message: enquirySchema.shape.message,
  'cf-turnstile-response': z.string().default(''),
}

export const bookingSchema = z.discriminatedUnion('service', [
  z.object({ ...bookingCommon, service: z.literal('in_house'), branch_id: id }),
  z.object({
    ...bookingCommon,
    service: z.literal('outside'),
    address_line: z.string().trim().min(5).max(300),
    postcode: z.string().trim().regex(/^\d{5}$/),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(60),
    setup_notes: optional(z.string().trim().max(1000)),
  }),
])

export type BookingForm = z.infer<typeof bookingSchema>
/** Fields shown on the details step; `pax` also covers the package and hall limits. */
export type BookingField =
  | 'name' | 'phone' | 'email' | 'event_date' | 'event_time' | 'pax' | 'message'
  | 'branch_id' | 'address_line' | 'postcode' | 'city' | 'state' | 'setup_notes'

type ChoiceGroup = { id: number; choose_count: number; items: { id: number }[] }

/**
 * Reads menu choices sent as g<groupId>=<menuItemId> (repeated for several items).
 * Each group needs exactly choose_count different items, all from that group.
 * Returns the choices keyed by group id, and the ids of groups that are not right.
 */
export function checkMenuChoices(groups: ChoiceGroup[], raw: Record<string, unknown>) {
  const choices: Record<string, number[]> = {}
  const bad: number[] = []
  for (const g of groups) {
    const v = raw[`g${g.id}`]
    const picked = [...new Set((Array.isArray(v) ? v : v == null ? [] : [v]).map(Number))]
    const allowed = new Set(g.items.map((i) => i.id))
    if (picked.length === g.choose_count && picked.every((n) => allowed.has(n))) choices[g.id] = picked
    else bad.push(g.id)
  }
  return { choices, bad }
}

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




// Checkbox lists send one value per ticked box: nothing, a string, or an array.
const idList = z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(id).max(200))

export const enquiryUpdateSchema = z
  .object({
    status: z.enum(['new', 'quoted', 'confirmed', 'declined']),
    branch_id: optional(id),
    delivery_fee_sen: optional(price),
    decline_reason: text(500),
    admin_notes: text(2000),
  })
  .refine((v) => v.status !== 'declined' || v.decline_reason, { path: ['decline_reason'] })

export const packageGroupSchema = z
  .object({
    name,
    name_bm: text(120),
    choose_count: z.coerce.number().int().min(1).max(50),
    sort_order: sortOrder,
    items: idList,
  })
  .refine((v) => v.items.length >= v.choose_count, { path: ['items'] })

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
  folder: z.enum(['packages', 'menu', 'gallery', 'cuisines', 'branches', 'occasions', 'clients', 'testimonials']),
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
  .object({
    ...common,
    ...imageUpload,
    slug,
    name_bm: text(120),
    address: text(300),
    phone: text(30),
    maps_link: optional(z.url({ protocol: /^https?$/ }).max(500)),
    has_hall: checkbox,
    hall_capacity: optional(z.coerce.number().int().min(1).max(100_000)),
  })
  .refine(altNeeded, { path: ['image_alt'] })

export const occasionSchema = z
  .object({ ...common, ...imageUpload, slug, name_bm: text(120), description: text(1000), description_bm: text(1000) })
  .refine(altNeeded, { path: ['image_alt'] })

// A client is only its logo, so one must be uploaded or picked from the library.
export const clientSchema = z
  .object({ ...common, ...imageUpload })
  .refine(altNeeded, { path: ['image_alt'] })
  .refine((v) => v.image_file || v.image_id, { path: ['image_file'] })

// A gallery card is its photo, so one must be uploaded or picked from the library.
export const galleryItemSchema = z
  .object({ ...common, ...imageUpload, event_type: z.string().trim().min(1).max(60), caption: text(120), is_tall: checkbox })
  .refine(altNeeded, { path: ['image_alt'] })
  .refine((v) => v.image_file || v.image_id, { path: ['image_file'] })

export const testimonialSchema = z
  .object({
    ...common,
    ...imageUpload,
    role: text(60),
    location: text(60),
    event_type: text(30),
    event_detail: text(80),
    quote: z.string().trim().min(1).max(1000),
    rating: z.coerce.number().int().min(1).max(5),
  })
  .refine(altNeeded, { path: ['image_alt'] })

export const menuItemSchema = z
  .object({
    ...common,
    ...imageUpload,
    name_bm: text(120),
    cuisine_id: optional(id),
    description: text(1000),
    description_bm: text(1000),
    category: text(60),
    price_sen: optional(price),
    is_bestseller: checkbox,
  })
  .refine(altNeeded, { path: ['image_alt'] })

export const packageSchema = z
  .object({
    ...common,
    ...imageUpload,
    slug,
    name_bm: text(120),
    cuisine_id: id,
    service_type: z.enum(['in_house', 'outside', 'both']),
    description: text(1000),
    description_bm: text(1000),
    price_sen: price,
    min_pax: z.coerce.number().int().min(1).max(10_000),
    max_pax: optional(z.coerce.number().int().min(1).max(10_000)),
    inclusions: lines,
    inclusions_bm: z.preprocess((v) => v ?? '', lines),
    is_popular: checkbox,
  })
  .refine(altNeeded, { path: ['image_alt'] })
  .refine((v) => v.max_pax == null || v.max_pax >= v.min_pax, { path: ['max_pax'] })
