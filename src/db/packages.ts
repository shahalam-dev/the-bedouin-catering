import { changed, type Status, type WithImage } from './shared'

export type Package = {
  id: number
  slug: string
  branch_id: number
  cuisine_id: number
  name: string
  description: string | null
  price_sen: number
  min_pax: number
  inclusions: string[]
  is_popular: boolean
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

/** Package plus the branch and cuisine names shown as chips on the card. */
export type PackageWithNames = Package & WithImage & {
  branch_name: string
  branch_slug: string
  cuisine_name: string
  cuisine_slug: string
}

export type PackageInput = Omit<Package, 'id' | 'created_at' | 'updated_at'>

type Row<T> = Omit<T, 'inclusions' | 'is_popular'> & { inclusions: string; is_popular: number }

function fromRow<T extends Package>(r: Row<T>): T {
  return { ...r, inclusions: JSON.parse(r.inclusions) as string[], is_popular: r.is_popular === 1 } as T
}

const SELECT_WITH_NAMES = `
  SELECT p.*, b.name AS branch_name, b.slug AS branch_slug, c.name AS cuisine_name, c.slug AS cuisine_slug,
    m.r2_key AS image_key, m.alt AS image_alt
  FROM packages p
  JOIN branches b ON b.id = p.branch_id
  JOIN cuisines c ON c.id = p.cuisine_id
  LEFT JOIN media m ON m.id = p.image_id`

/**
 * Public listing: published packages whose branch and cuisine are also published.
 * Both filters are optional (pass nothing for all published packages).
 */
export async function listPublishedPackages(
  db: D1Database,
  filter: { branchId?: number; cuisineId?: number } = {},
): Promise<PackageWithNames[]> {
  const { results } = await db
    .prepare(
      `${SELECT_WITH_NAMES}
       WHERE p.status = 'published' AND b.status = 'published' AND c.status = 'published'
         AND (?1 IS NULL OR p.branch_id = ?1)
         AND (?2 IS NULL OR p.cuisine_id = ?2)
       ORDER BY p.is_popular DESC, p.sort_order, p.price_sen, p.name`,
    )
    .bind(filter.branchId ?? null, filter.cuisineId ?? null)
    .all<Row<PackageWithNames>>()
  return results.map(fromRow)
}

export async function getPublishedPackageBySlug(db: D1Database, slug: string): Promise<PackageWithNames | null> {
  const row = await db
    .prepare(
      `${SELECT_WITH_NAMES}
       WHERE p.slug = ? AND p.status = 'published' AND b.status = 'published' AND c.status = 'published'`,
    )
    .bind(slug)
    .first<Row<PackageWithNames>>()
  return row ? fromRow(row) : null
}

/** Admin listing: every package regardless of status. */
export async function listPackages(db: D1Database): Promise<PackageWithNames[]> {
  const { results } = await db
    .prepare(`${SELECT_WITH_NAMES} ORDER BY b.sort_order, c.sort_order, p.sort_order, p.name`)
    .all<Row<PackageWithNames>>()
  return results.map(fromRow)
}

export async function getPackageById(db: D1Database, id: number): Promise<Package | null> {
  const row = await db.prepare('SELECT * FROM packages WHERE id = ?').bind(id).first<Row<Package>>()
  return row ? fromRow(row) : null
}

export async function createPackage(db: D1Database, p: PackageInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO packages
         (slug, branch_id, cuisine_id, name, description, price_sen, min_pax, inclusions, is_popular, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      p.slug, p.branch_id, p.cuisine_id, p.name, p.description, p.price_sen, p.min_pax,
      JSON.stringify(p.inclusions), p.is_popular ? 1 : 0, p.image_id, p.sort_order, p.status,
    )
    .first<{ id: number }>()
  return row!.id
}

export async function updatePackage(db: D1Database, id: number, p: PackageInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE packages SET
         slug = ?, branch_id = ?, cuisine_id = ?, name = ?, description = ?, price_sen = ?, min_pax = ?,
         inclusions = ?, is_popular = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(
      p.slug, p.branch_id, p.cuisine_id, p.name, p.description, p.price_sen, p.min_pax,
      JSON.stringify(p.inclusions), p.is_popular ? 1 : 0, p.image_id, p.sort_order, p.status, id,
    )
    .run()
  return changed(r)
}

export async function setPackageStatus(db: D1Database, id: number, status: Status): Promise<boolean> {
  const r = await db
    .prepare("UPDATE packages SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(status, id)
    .run()
  return changed(r)
}

/** Enquiries that point at this package keep their row (package_id becomes NULL). */
export async function deletePackage(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM packages WHERE id = ?').bind(id).run())
}
