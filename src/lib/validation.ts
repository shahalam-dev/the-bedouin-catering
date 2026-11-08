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
