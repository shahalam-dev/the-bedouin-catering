import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import type { z } from 'zod'
import { createBranch, getBranchById, listBranches, updateBranch, type Branch } from '../../db/branches'
import { createCuisine, getCuisineById, listCuisines, updateCuisine, type Cuisine } from '../../db/cuisines'
import { listMedia, type Media } from '../../db/media'
import { createMenuItem, getMenuItemById, listMenuItems, updateMenuItem } from '../../db/menu_items'
import { createOccasion, getOccasionById, listOccasions, updateOccasion } from '../../db/occasions'
import { createPackage, getPackageById, listPackages, updatePackage } from '../../db/packages'
import type { Status } from '../../db/shared'
import type { AdminEnv } from '../../lib/auth'
import { formatRM } from '../../lib/format'
import { adminT } from '../../lib/i18n'
import {
  branchSchema,
  cuisineSchema,
  menuItemSchema,
  occasionSchema,
  packageSchema,
} from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { fieldAria, FormField } from '../../views/components/FormField'
import { StatusPill } from '../../views/components/StatusPill'

// One editor for every "content" table. Each table is described by a Resource below:
// its schema, form fields and db functions. Validation lives in the zod schemas.

type Kind = 'text' | 'slug' | 'textarea' | 'int' | 'price' | 'lines' | 'checkbox' | 'status' | 'branch' | 'cuisine' | 'image'
type Field = { name: string; kind: Kind; required?: boolean }
type Row = { id: number; name: string; status: Status } & Record<string, unknown>
type Values = Record<string, string>
type Errors = Record<string, string>
type Options = { branches: Branch[]; cuisines: Cuisine[]; media: Media[] }

export type Section = 'packages' | 'menu' | 'occasions' | 'branches' | 'cuisines'

type Resource = {
  key: Section
  schema: z.ZodType<Record<string, unknown>>
  fields: Field[]
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
  list(db: D1Database): Promise<L[]>
  get(db: D1Database, id: number): Promise<R | null>
  create(db: D1Database, input: z.output<S>): Promise<number>
  update(db: D1Database, id: number, input: z.output<S>): Promise<boolean>
  summary?(row: L): string
}): Resource {
  return r as unknown as Resource
}

const meta: Field[] = [
  { name: 'image_id', kind: 'image' },
  { name: 'sort_order', kind: 'int' },
  { name: 'status', kind: 'status' },
]

export const resources: Resource[] = [
  define({
    key: 'packages',
    schema: packageSchema,
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'branch_id', kind: 'branch', required: true },
      { name: 'cuisine_id', kind: 'cuisine', required: true },
      { name: 'price_sen', kind: 'price', required: true },
      { name: 'min_pax', kind: 'int', required: true },
      { name: 'inclusions', kind: 'lines' },
      { name: 'description', kind: 'textarea' },
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
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'cuisine_id', kind: 'cuisine' },
      { name: 'category', kind: 'text' },
      { name: 'price_sen', kind: 'price' },
      { name: 'description', kind: 'textarea' },
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
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'description', kind: 'textarea' },
      ...meta,
    ],
    list: listOccasions,
    get: getOccasionById,
    create: createOccasion,
    update: updateOccasion,
  }),
  define({
    key: 'branches',
    schema: branchSchema,
    fields: [
      { name: 'name', kind: 'text', required: true },
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
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'slug', kind: 'slug', required: true },
      { name: 'description', kind: 'textarea' },
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
    case 'textarea': return e.optionalText
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

const NEW_DEFAULTS: Values = { status: 'draft', sort_order: '0' }

const Control = ({ f, value, error, options }: { f: Field; value: string; error?: string; options: Options }) => {
  const id = f.name
  const label = adminT.fields[f.name] ?? f.name
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
          : f.kind === 'image'
            ? options.media.map((m) => ({ id: String(m.id), label: `${m.alt} (${adminT.media.folders[m.folder]})` }))
            : null

  const control = choices ? (
    <select {...common}>
      {f.kind !== 'status' && <option value="">{f.required ? adminT.choose : adminT.noneOption}</option>}
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

type FormProps = { r: Resource; values: Values; errors: Errors; options: Options; id?: number }

const FormPage = ({ r, values, errors, options, id }: FormProps) => {
  const heading = id ? adminT.editItem(values.name || '') : adminT.newItem(adminT.sections[r.key])
  return (
    <>
      <title>{`${heading} | ${adminT.title}`}</title>
      <div class="admin-head">
        <h1>{heading}</h1>
      </div>
      <form method="post" class="panel form" novalidate>
        {Object.keys(errors).length > 0 && (
          <p class="notice notice--error" role="alert">
            {adminT.formError}
          </p>
        )}
        <div class="form__grid">
          {r.fields.map((f) => (
            <div class={f.kind === 'textarea' || f.kind === 'lines' ? 'form__wide' : undefined}>
              <Control f={f} value={values[f.name] ?? ''} error={errors[f.name]} options={options} />
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
    const errors = Object.fromEntries(r.fields.filter((f) => bad.has(f.name)).map((f) => [f.name, errorFor(f)]))
    const id = c.req.param('id')
    return renderForm(c as unknown as Context<AdminEnv>, result.data as Values, errors, id ? Number(id) : undefined)
  })

  // Saves, or shows the form again if the slug is already in use. A falsy result means the row is gone.
  const save = async (c: Context<AdminEnv>, write: () => Promise<number | boolean>, id?: number) => {
    let ok
    try {
      ok = await write()
    } catch (e) {
      if (!isSlugTaken(e)) throw e
      return renderForm(c, (await c.req.parseBody()) as Values, { slug: adminT.errors.slugTaken }, id)
    }
    if (!ok) return c.notFound()
    // shortcut: public pages are not edge-cached yet, so there is nothing to purge; add purging here when they are.
    return c.redirect(`/admin/${r.key}?saved=1`, 303)
  }

  app.get('/', async (c) => c.render(<ListPage r={r} rows={await r.list(c.env.DB)} saved={c.req.query('saved') === '1'} />))

  app.get('/new', (c) => renderForm(c, NEW_DEFAULTS, {}))

  app.post('/new', validate, (c) => save(c, () => r.create(c.env.DB, c.req.valid('form'))))

  app.get('/:id{[0-9]+}', async (c) => {
    const id = Number(c.req.param('id'))
    const row = await r.get(c.env.DB, id)
    return row ? renderForm(c, toValues(r.fields, row), {}, id) : c.notFound()
  })

  app.post('/:id{[0-9]+}', validate, (c) => {
    const id = Number(c.req.param('id'))
    return save(c, () => r.update(c.env.DB, id, c.req.valid('form')), id)
  })

  return app
}
