import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import type { z } from 'zod'
import { createBranch, getBranchById, listBranches, updateBranch, type Branch } from '../../db/branches'
import { createClient, getClientById, listClients, updateClient } from '../../db/clients'
import { createGalleryItem, getGalleryItemById, listGallery, updateGalleryItem } from '../../db/gallery'
import { createCuisine, getCuisineById, listCuisines, updateCuisine, type Cuisine } from '../../db/cuisines'
import { listMedia, type Media, type MediaFolder } from '../../db/media'
import { createMenuItem, getMenuItemById, listMenuItems, updateMenuItem } from '../../db/menu_items'
import { createOccasion, getOccasionById, listOccasions, updateOccasion } from '../../db/occasions'
import { createPackage, getPackageById, listPackages, updatePackage } from '../../db/packages'
import { createTestimonial, getTestimonialById, listTestimonials, updateTestimonial } from '../../db/testimonials'
import type { Status } from '../../db/shared'
import type { AdminEnv } from '../../lib/auth'
import { formatRM } from '../../lib/format'
import { adminT } from '../../lib/i18n'
import { imgUrl, storeUpload } from '../../lib/images'
import {
  branchSchema,
  clientSchema,
  cuisineSchema,
  galleryItemSchema,
  menuItemSchema,
  IMAGE_TYPES,
  occasionSchema,
  packageSchema,
  testimonialSchema,
} from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { fieldAria, FormField } from '../../views/components/FormField'
import { StatusPill } from '../../views/components/StatusPill'

// One editor for every "content" table. Each table is described by a Resource below:
// its schema, form fields and db functions. Validation lives in the zod schemas.

type Kind = 'text' | 'slug' | 'textarea' | 'int' | 'price' | 'lines' | 'checkbox' | 'status' | 'branch' | 'cuisine' | 'rating' | 'upload'
type Field = { name: string; kind: Kind; required?: boolean; /** Overrides adminT.fields[name]. */ label?: string }
type Row = { id: number; name: string; status: Status } & Record<string, unknown>
type Values = Record<string, string>
type Errors = Record<string, string>
type Options = { branches: Branch[]; cuisines: Cuisine[]; media: Media[] }

export type Section = 'packages' | 'menu' | 'occasions' | 'gallery' | 'clients' | 'testimonials' | 'branches' | 'cuisines'

type Resource = {
  key: Section
  schema: z.ZodType<Record<string, unknown>>
  fields: Field[]
  /** The media folder new images go to, and the only one the picker shows. */
  uploadFolder: MediaFolder
  list(db: D1Database): Promise<Row[]>
  get(db: D1Database, id: number): Promise<Row | null>
  create(db: D1Database, input: Record<string, unknown>): Promise<number>
  update(db: D1Database, id: number, input: Record<string, unknown>): Promise<boolean>
  /** Extra text shown in the list next to the name. */
  summary?(row: Row): string
}

/** Type-checks that the schema output matches what the db functions take, then erases the types. */
function define<S extends z.ZodType, R extends { id: number; name: string; status: Status }, L extends R = R>(r: {
  key: Section
  schema: S
  fields: Field[]
  uploadFolder: MediaFolder
  list(db: D1Database): Promise<L[]>
  get(db: D1Database, id: number): Promise<R | null>
  create(db: D1Database, input: z.output<S>): Promise<number>
  update(db: D1Database, id: number, input: z.output<S>): Promise<boolean>
  summary?(row: L): string
}): Resource {
  return r as unknown as Resource
}

// Image last: the upload box and library picker sit at the bottom of the form.
const meta: Field[] = [
  { name: 'sort_order', kind: 'int' },
  { name: 'status', kind: 'status' },
  { name: 'image_id', kind: 'upload' },
]

export const resources: Resource[] = [
  define({
    key: 'packages',
    schema: packageSchema,
    uploadFolder: 'packages',
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'name_bm', kind: 'text' },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'branch_id', kind: 'branch', required: true },
      { name: 'cuisine_id', kind: 'cuisine', required: true },
      { name: 'price_sen', kind: 'price', required: true },
      { name: 'min_pax', kind: 'int', required: true },
      { name: 'inclusions', kind: 'lines' },
      { name: 'inclusions_bm', kind: 'lines' },
      { name: 'description', kind: 'textarea' },
      { name: 'description_bm', kind: 'textarea' },
      { name: 'is_popular', kind: 'checkbox' },
      ...meta,
    ],
    list: listPackages,
    get: getPackageById,
    create: createPackage,
    update: updatePackage,
    summary: (p) => `${p.branch_name} · ${p.cuisine_name} · ${formatRM(p.price_sen)} / pax`,
  }),
  define({
    key: 'menu',
    schema: menuItemSchema,
    uploadFolder: 'menu',
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'name_bm', kind: 'text' },
      { name: 'cuisine_id', kind: 'cuisine' },
      { name: 'category', kind: 'text' },
      { name: 'price_sen', kind: 'price' },
      { name: 'description', kind: 'textarea' },
      { name: 'description_bm', kind: 'textarea' },
      { name: 'is_bestseller', kind: 'checkbox' },
      ...meta,
    ],
    list: listMenuItems,
    get: getMenuItemById,
    create: createMenuItem,
    update: updateMenuItem,
    summary: (m) => [m.category, m.price_sen != null && formatRM(m.price_sen)].filter(Boolean).join(' · '),
  }),
  define({
    key: 'occasions',
    schema: occasionSchema,
    uploadFolder: 'occasions',
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'name_bm', kind: 'text' },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'description', kind: 'textarea' },
      { name: 'description_bm', kind: 'textarea' },
      ...meta,
    ],
    list: listOccasions,
    get: getOccasionById,
    create: createOccasion,
    update: updateOccasion,
  }),
  define({
    key: 'gallery',
    schema: galleryItemSchema,
    uploadFolder: 'gallery',
    fields: [
      { name: 'name', kind: 'text', required: true, label: adminT.fields.title },
      { name: 'event_type', kind: 'text', required: true },
      { name: 'caption', kind: 'text' },
      { name: 'is_tall', kind: 'checkbox' },
      ...meta,
    ],
    list: listGallery,
    get: getGalleryItemById,
    create: createGalleryItem,
    update: updateGalleryItem,
    summary: (g) => [g.event_type, g.caption, g.is_tall && adminT.tall].filter(Boolean).join(' · '),
  }),
  define({
    key: 'clients',
    schema: clientSchema,
    uploadFolder: 'clients',
    fields: [{ name: 'name', kind: 'text', required: true }, ...meta],
    list: listClients,
    get: getClientById,
    create: createClient,
    update: updateClient,
  }),
  define({
    key: 'testimonials',
    schema: testimonialSchema,
    uploadFolder: 'testimonials',
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'quote', kind: 'textarea', required: true },
      { name: 'rating', kind: 'rating', required: true },
      ...meta,
    ],
    list: listTestimonials,
    get: getTestimonialById,
    create: createTestimonial,
    update: updateTestimonial,
    summary: (t) => `${t.rating}★ · ${t.quote.slice(0, 60)}`,
  }),
  define({
    key: 'branches',
    schema: branchSchema,
    uploadFolder: 'branches',
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'name_bm', kind: 'text' },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'address', kind: 'textarea' },
      { name: 'phone', kind: 'text' },
      ...meta,
    ],
    list: listBranches,
    get: getBranchById,
    create: createBranch,
    update: updateBranch,
  }),
  define({
    key: 'cuisines',
    schema: cuisineSchema,
    uploadFolder: 'cuisines',
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'name_bm', kind: 'text' },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'description', kind: 'textarea' },
      { name: 'description_bm', kind: 'textarea' },
      ...meta,
    ],
    list: listCuisines,
    get: getCuisineById,
    create: createCuisine,
    update: updateCuisine,
  }),
]

const errorFor = (f: Field): string => {
  const e = adminT.errors
  switch (f.kind) {
    case 'text': return f.required ? e.text : e.optionalText
    case 'textarea': return f.required ? e.requiredText : e.optionalText
    case 'slug': return e.slug
    case 'int': return e.int
    case 'price': return e.price
    case 'lines': return e.lines
    default: return e.select
  }
}

/** Db row -> the strings the form shows. */
function toValues(fields: Field[], row: Row): Values {
  return Object.fromEntries(
    fields.map((f) => {
      const v = row[f.name]
      if (v == null) return [f.name, '']
      if (f.kind === 'price') return [f.name, ((v as number) / 100).toFixed(2).replace(/\.00$/, '')]
      if (f.kind === 'lines') return [f.name, (v as string[]).join('\n')]
      if (f.kind === 'checkbox') return [f.name, v ? 'on' : '']
      return [f.name, String(v)]
    }),
  )
}

const NEW_DEFAULTS: Values = { status: 'draft', sort_order: '0', rating: '5' }

const Control = ({ f, value, error, options }: { f: Field; value: string; error?: string; options: Options }) => {
  const id = f.name
  const label = f.label ?? adminT.fields[f.name] ?? f.name
  const common = { id, name: id, class: 'input', required: f.required, ...fieldAria(id, error) }

  if (f.kind === 'checkbox') {
    return (
      <label class="checkbox">
        <input type="checkbox" id={id} name={id} checked={value === 'on'} />
        {label}
      </label>
    )
  }

  const choices =
    f.kind === 'status'
      ? (Object.keys(adminT.statuses) as Status[]).map((s) => ({ id: s, label: adminT.statuses[s] }))
      : f.kind === 'branch'
        ? options.branches.map((b) => ({ id: String(b.id), label: b.name }))
        : f.kind === 'cuisine'
          ? options.cuisines.map((c) => ({ id: String(c.id), label: c.name }))
          : f.kind === 'rating'
            ? ['5', '4', '3', '2', '1'].map((n) => ({ id: n, label: `${'★'.repeat(Number(n))} (${n})` }))
            : null

  const control = choices ? (
    <select {...common}>
      {f.kind !== 'status' && f.kind !== 'rating' && <option value="">{f.required ? adminT.choose : adminT.noneOption}</option>}
      {choices.map((o) => (
        <option value={o.id} selected={o.id === value}>
          {o.label}
        </option>
      ))}
    </select>
  ) : f.kind === 'textarea' || f.kind === 'lines' ? (
    <textarea {...common} rows={f.kind === 'lines' ? 5 : 3}>
      {value}
    </textarea>
  ) : (
    <input
      {...common}
      type="text"
      value={value}
      inputmode={f.kind === 'int' ? 'numeric' : f.kind === 'price' ? 'decimal' : undefined}
    />
  )

  return (
    <FormField id={id} label={label} error={error}>
      {control}
    </FormField>
  )
}

/** Upload a new image, or pick one from the library (radio cards with thumbnails). */
const ImagePicker = ({ value, alt, errors, media }: { value: string; alt: string; errors: Errors; media: Media[] }) => {
  const t = adminT.media
  return (
    <fieldset class="image-picker">
      <legend>{adminT.fields.image_id}</legend>
      <p class="caption">{t.uploadNew}</p>
      <div class="form__grid">
        <FormField id="image_file" label={t.file} error={errors.image_file}>
          <input id="image_file" name="image_file" type="file" class="input" accept={[...IMAGE_TYPES, '.heic', '.heif'].join(',')} {...fieldAria('image_file', errors.image_file)} />
        </FormField>
        <FormField id="image_alt" label={t.alt} error={errors.image_alt}>
          <input id="image_alt" name="image_alt" type="text" class="input" maxlength={300} value={alt} {...fieldAria('image_alt', errors.image_alt)} />
        </FormField>
      </div>
      <fieldset class="image-picker__library">
        <legend>{t.orChoose}</legend>
        {/* shortcut: renders the whole library; add paging or a folder filter if it grows past a few hundred images. */}
        <div class="option-grid">
          <label class="option-card">
            <input type="radio" name="image_id" value="" checked={!value} class="visually-hidden" />
            <span class="option-card__photo" aria-hidden="true" />
            <span class="caption">{adminT.noImage}</span>
          </label>
          {media.map((m) => (
            <label class="option-card">
              <input type="radio" name="image_id" value={String(m.id)} checked={value === String(m.id)} class="visually-hidden" />
              <img class="option-card__photo" src={imgUrl(m.r2_key, 'thumb')} alt="" loading="lazy" decoding="async" />
              <span class="caption">{m.alt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </fieldset>
  )
}

type FormProps = { r: Resource; values: Values; errors: Errors; options: Options; id?: number }

const FormPage = ({ r, values, errors, options, id }: FormProps) => {
  const heading = id ? adminT.editItem(values.name || '') : adminT.newItem(adminT.sections[r.key])
  return (
    <>
      <title>{`${heading} | ${adminT.title}`}</title>
      <div class="admin-head">
        <h1>{heading}</h1>
      </div>
      <form method="post" class="panel form" enctype="multipart/form-data" novalidate>
        {Object.keys(errors).length > 0 && (
          <p class="notice notice--error" role="alert">
            {adminT.formError}
          </p>
        )}
        <div class="form__grid">
          {r.fields.map((f) => (
            <div class={f.kind === 'textarea' || f.kind === 'lines' || f.kind === 'upload' ? 'form__wide' : undefined}>
              {f.kind === 'upload' ? (
                <ImagePicker value={values[f.name] ?? ''} alt={values.image_alt ?? ''} errors={errors} media={options.media.filter((m) => m.folder === r.uploadFolder)} />
              ) : (
                <Control f={f} value={values[f.name] ?? ''} error={errors[f.name]} options={options} />
              )}
            </div>
          ))}
        </div>
        <div class="form__actions">
          <Button type="submit">{adminT.save}</Button>
          <Button variant="outline" href={`/admin/${r.key}`}>
            {adminT.cancel}
          </Button>
        </div>
      </form>
    </>
  )
}

const ListPage = ({ r, rows, saved }: { r: Resource; rows: Row[]; saved: boolean }) => (
  <>
    <title>{`${adminT.sections[r.key]} | ${adminT.title}`}</title>
    <div class="admin-head">
      <h1>{adminT.sections[r.key]}</h1>
      <Button href={`/admin/${r.key}/new`}>{adminT.add}</Button>
    </div>
    {saved && (
      <p class="notice notice--success" role="status">
        {adminT.saved}
      </p>
    )}
    {rows.length === 0 ? (
      <p class="panel">{adminT.none}</p>
    ) : (
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">{adminT.name}</th>
              <th scope="col">{adminT.status}</th>
              <th scope="col" class="actions">
                {adminT.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr>
                <td>
                  <strong>{row.name}</strong>
                  {r.summary && <div class="caption">{r.summary(row)}</div>}
                </td>
                <td>
                  <StatusPill status={row.status} />
                </td>
                <td class="actions">
                  <a href={`/admin/${r.key}/${row.id}`} aria-label={`${adminT.edit} ${row.name}`}>
                    {adminT.edit}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </>
)

async function loadOptions(db: D1Database): Promise<Options> {
  const [branches, cuisines, media] = await Promise.all([listBranches(db), listCuisines(db), listMedia(db)])
  return { branches, cuisines, media }
}

const isSlugTaken = (e: unknown) => /UNIQUE constraint failed: \w+\.slug/.test(String(e))

export function contentRoutes(r: Resource) {
  const app = new Hono<AdminEnv>()

  const renderForm = async (c: Context<AdminEnv>, values: Values, errors: Errors, id?: number) => {
    if (Object.keys(errors).length) c.status(400)
    return c.render(<FormPage r={r} values={values} errors={errors} options={await loadOptions(c.env.DB)} id={id} />)
  }

  // Invalid input: show the form again with the submitted values and a message per bad field.
  const validate = zValidator('form', r.schema, async (result, c) => {
    if (result.success) return
    const bad = new Set(result.error.issues.map((i) => String(i.path[0])))
    const errors: Errors = Object.fromEntries(r.fields.filter((f) => bad.has(f.name)).map((f) => [f.name, errorFor(f)]))
    if (bad.has('image_file')) errors.image_file = adminT.media.errors.file
    if (bad.has('image_alt')) errors.image_alt = adminT.media.errors.alt
    const id = c.req.param('id')
    return renderForm(c as unknown as Context<AdminEnv>, result.data as Values, errors, id ? Number(id) : undefined)
  })

  // Stores an uploaded image first (it then becomes the row's image), then saves the row.
  // Shows the form again if the upload fails or the slug is already in use. A falsy result means the row is gone.
  const save = async (c: Context<AdminEnv>, input: Record<string, unknown>, id?: number) => {
    const form = async () => (await c.req.parseBody()) as Values
    if (input.image_file instanceof File) {
      const stored = await storeUpload(c.env, r.uploadFolder, input.image_file, String(input.image_alt))
      if (typeof stored === 'string') return renderForm(c, await form(), { image_file: adminT.media[stored] }, id)
      input.image_id = stored
    }
    let ok
    try {
      ok = id ? await r.update(c.env.DB, id, input) : await r.create(c.env.DB, input)
    } catch (e) {
      if (!isSlugTaken(e)) throw e
      // A just-uploaded image is in the library now: keep it selected rather than uploading it again.
      const values = { ...(await form()), image_id: String(input.image_id ?? ''), image_alt: '' }
      return renderForm(c, values, { slug: adminT.errors.slugTaken }, id)
    }
    if (!ok) return c.notFound()
    // shortcut: public pages are not edge-cached yet, so there is nothing to purge; add purging here when they are.
    return c.redirect(`/admin/${r.key}?saved=1`, 303)
  }

  app.get('/', async (c) => c.render(<ListPage r={r} rows={await r.list(c.env.DB)} saved={c.req.query('saved') === '1'} />))

  app.get('/new', (c) => renderForm(c, NEW_DEFAULTS, {}))

  app.post('/new', validate, (c) => save(c, c.req.valid('form')))

  app.get('/:id{[0-9]+}', async (c) => {
    const id = Number(c.req.param('id'))
    const row = await r.get(c.env.DB, id)
    return row ? renderForm(c, toValues(r.fields, row), {}, id) : c.notFound()
  })

  app.post('/:id{[0-9]+}', validate, (c) => {
    const id = Number(c.req.param('id'))
    return save(c, c.req.valid('form'), id)
  })

  return app
}
