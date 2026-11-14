import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import { listMenuItems, type MenuItem } from '../../db/menu_items'
import { createGroup, deleteGroup, getGroupById, listGroupItemIds, listGroups, updateGroup } from '../../db/package_groups'
import { getPackageById, type Package } from '../../db/packages'
import type { AdminEnv } from '../../lib/auth'
import { adminT } from '../../lib/i18n'
import { packageGroupSchema } from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { fieldAria, FormField } from '../../views/components/FormField'

// Menu choice groups of one package, at /admin/packages/:packageId/groups.
// Dishes come from the menu items of the package's cuisine.

const t = adminT.groups
type Values = { name?: string; name_bm?: string; choose_count?: string; sort_order?: string; items: string[] }
type Errors = Record<string, string>

const base = (pkg: Package) => `/admin/packages/${pkg.id}/groups`

const ListPage = ({ pkg, groups, saved }: { pkg: Package; groups: Awaited<ReturnType<typeof listGroups>>; saved: string | undefined }) => (
  <>
    <title>{`${t.title(pkg.name)} | ${adminT.title}`}</title>
    <div class="admin-head">
      <h1>{t.title(pkg.name)}</h1>
      <a href={`/admin/packages/${pkg.id}`}>{t.backToPackage}</a>
    </div>
    {saved && (
      <p class="notice notice--success" role="status">
        {saved === 'deleted' ? t.deleted : adminT.saved}
      </p>
    )}
    <p class="panel">{t.intro}</p>
    <div class="admin-head">
      <Button href={`${base(pkg)}/new`}>{t.add}</Button>
    </div>
    {groups.length === 0 ? (
      <p class="panel">{adminT.none}</p>
    ) : (
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">{adminT.name}</th>
              <th scope="col" class="actions">
                {adminT.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr>
                <td>
                  <strong>{g.name}</strong>
                  <div class="caption">
                    {t.summary(g.choose_count, g.items.length)}: {g.items.map((i) => i.name).join(', ')}
                  </div>
                </td>
                <td class="actions">
                  <a href={`${base(pkg)}/${g.id}`} aria-label={`${adminT.edit} ${g.name}`}>
                    {adminT.edit}
                  </a>
                  <form method="post" action={`${base(pkg)}/${g.id}/delete`}>
                    <Button type="submit" variant="outline">
                      {t.delete}
                      <span class="visually-hidden"> {g.name}</span>
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </>
)

type FormProps = { pkg: Package; dishes: MenuItem[]; values: Values; errors: Errors; groupId?: number }

const FormPage = ({ pkg, dishes, values, errors, groupId }: FormProps) => {
  const heading = groupId ? t.editGroup(values.name ?? '') : t.add
  const text = (k: 'name' | 'name_bm' | 'choose_count' | 'sort_order', label: string, attrs: Record<string, string | boolean> = {}) => (
    <FormField id={k} label={label} error={errors[k]}>
      <input id={k} name={k} type="text" class="input" value={values[k] ?? ''} {...attrs} {...fieldAria(k, errors[k])} />
    </FormField>
  )
  return (
    <>
      <title>{`${heading} | ${adminT.title}`}</title>
      <div class="admin-head">
        <h1>{heading}</h1>
        <span class="caption">{pkg.name}</span>
      </div>
      <form method="post" class="panel form" novalidate>
        {Object.keys(errors).length > 0 && (
          <p class="notice notice--error" role="alert">
            {adminT.formError}
          </p>
        )}
        <div class="form__grid">
          {text('name', adminT.fields.name, { required: true })}
          {text('name_bm', adminT.fields.name_bm)}
          {text('choose_count', t.choose_count, { required: true, inputmode: 'numeric' })}
          {text('sort_order', adminT.fields.sort_order, { inputmode: 'numeric' })}
        </div>
        <fieldset class="field" aria-describedby={errors.items ? 'items-error' : undefined}>
          <legend>{t.items}</legend>
          {errors.items && (
            <p id="items-error" class="field__error">
              {errors.items}
            </p>
          )}
          {dishes.length === 0 ? (
            <p>{t.noItems}</p>
          ) : (
            dishes.map((d) => (
              <label class="checkbox">
                <input type="checkbox" name="items" value={String(d.id)} checked={values.items.includes(String(d.id))} />
                {d.name}
                {d.status !== 'published' && <span class="caption"> ({adminT.statuses[d.status]})</span>}
              </label>
            ))
          )}
        </fieldset>
        <div class="form__actions">
          <Button type="submit">{adminT.save}</Button>
          <Button variant="outline" href={base(pkg)}>
            {adminT.cancel}
          </Button>
        </div>
      </form>
    </>
  )
}

const groups = new Hono<AdminEnv>()

const loadPackage = (c: Context<AdminEnv>) => getPackageById(c.env.DB, Number(c.req.param('packageId')))
const dishesFor = async (db: D1Database, pkg: Package) => (await listMenuItems(db)).filter((m) => m.cuisine_id === pkg.cuisine_id)
/** The group, only if it belongs to this package. */
const loadGroup = async (c: Context<AdminEnv>, pkg: Package) => {
  const g = await getGroupById(c.env.DB, Number(c.req.param('groupId')))
  return g && g.package_id === pkg.id ? g : null
}

const renderForm = async (c: Context<AdminEnv>, pkg: Package, values: Values, errors: Errors, groupId?: number) => {
  if (Object.keys(errors).length) c.status(400)
  return c.render(<FormPage pkg={pkg} dishes={await dishesFor(c.env.DB, pkg)} values={values} errors={errors} groupId={groupId} />)
}

const validate = zValidator('form', packageGroupSchema, async (result, c) => {
  if (result.success) return
  const ctx = c as unknown as Context<AdminEnv>
  const pkg = await loadPackage(ctx)
  if (!pkg) return c.notFound()
  const bad = new Set(result.error.issues.map((i) => String(i.path[0])))
  const e = adminT.errors
  const errors: Errors = {}
  if (bad.has('name')) errors.name = e.text
  if (bad.has('name_bm')) errors.name_bm = e.optionalText
  if (bad.has('choose_count')) errors.choose_count = e.int
  if (bad.has('sort_order')) errors.sort_order = e.int
  if (bad.has('items')) errors.items = t.itemsError
  const raw = result.data as unknown as Record<string, unknown>
  const items = raw.items == null ? [] : Array.isArray(raw.items) ? raw.items.map(String) : [String(raw.items)]
  const groupId = c.req.param('groupId')
  return renderForm(ctx, pkg, { ...(raw as Values), items }, errors, groupId ? Number(groupId) : undefined)
})

/** Only dishes of the package's cuisine can be added. */
const allowedItems = async (db: D1Database, pkg: Package, ids: number[]) => {
  const allowed = new Set((await dishesFor(db, pkg)).map((d) => d.id))
  return ids.every((id) => allowed.has(id))
}

groups.get('/', async (c) => {
  const pkg = await loadPackage(c)
  if (!pkg) return c.notFound()
  return c.render(<ListPage pkg={pkg} groups={await listGroups(c.env.DB, pkg.id)} saved={c.req.query('saved')} />)
})

groups.get('/new', async (c) => {
  const pkg = await loadPackage(c)
  return pkg ? renderForm(c, pkg, { choose_count: '1', sort_order: '0', items: [] }, {}) : c.notFound()
})

groups.post('/new', validate, async (c) => {
  const pkg = await loadPackage(c)
  if (!pkg) return c.notFound()
  const { items, ...g } = c.req.valid('form')
  if (!(await allowedItems(c.env.DB, pkg, items))) return renderForm(c, pkg, { ...strings(g), items: items.map(String) }, { items: adminT.errors.select })
  await createGroup(c.env.DB, { ...g, package_id: pkg.id }, items)
  return c.redirect(`${base(pkg)}?saved=1`, 303)
})

groups.get('/:groupId{[0-9]+}', async (c) => {
  const pkg = await loadPackage(c)
  const g = pkg && (await loadGroup(c, pkg))
  if (!pkg || !g) return c.notFound()
  const items = (await listGroupItemIds(c.env.DB, g.id)).map(String)
  return renderForm(c, pkg, { ...strings(g), items }, {}, g.id)
})

groups.post('/:groupId{[0-9]+}', validate, async (c) => {
  const pkg = await loadPackage(c)
  const g = pkg && (await loadGroup(c, pkg))
  if (!pkg || !g) return c.notFound()
  const { items, ...input } = c.req.valid('form')
  if (!(await allowedItems(c.env.DB, pkg, items))) return renderForm(c, pkg, { ...strings(input), items: items.map(String) }, { items: adminT.errors.select }, g.id)
  await updateGroup(c.env.DB, g.id, input, items)
  return c.redirect(`${base(pkg)}?saved=1`, 303)
})

groups.post('/:groupId{[0-9]+}/delete', async (c) => {
  const pkg = await loadPackage(c)
  const g = pkg && (await loadGroup(c, pkg))
  if (!pkg || !g) return c.notFound()
  await deleteGroup(c.env.DB, g.id)
  return c.redirect(`${base(pkg)}?saved=deleted`, 303)
})

function strings(g: { name: string; name_bm: string | null; choose_count: number; sort_order: number }) {
  return { name: g.name, name_bm: g.name_bm ?? '', choose_count: String(g.choose_count), sort_order: String(g.sort_order) }
}

export default groups
