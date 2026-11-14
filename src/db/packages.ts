import type { Lang } from '../lib/i18n'
import { changed, inLang, type Status, type WithImage } from './shared'

export type ServiceType = 'in_house' | 'outside' | 'both'

export type Package = {
  id: number
  slug: string
  cuisine_id: number
  service_type: ServiceType
  name: string
  name_bm: string | null
  price_sen: number
  min_pax: number
  max_pax: number | null
  inclusions: string[]
  inclusions_bm: string[]
  is_popular: boolean
  image_id: number | null
  /** R2 key of the details PDF, served at /media/<key>. */
  pdf_key: string | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

/** Package plus the cuisine name shown as a chip on the card. */
export type PackageWithNames = Package & WithImage & {
  cuisine_name: string
  cuisine_name_bm: string | null
  cuisine_slug: string
}

export type PackageInput = Omit<Package, 'id' | 'created_at' | 'updated_at'>

/** Name and inclusions in the visitor's language; empty BM copy falls back to English. */
export const packageInLang = <T extends Package>(p: T, lang: Lang): T => {
  const out = inLang(p, lang)
  return lang === 'bm' && p.inclusions_bm.length ? { ...out, inclusions: p.inclusions_bm } : out
}

type Row<T> = Omit<T, 'inclusions' | 'inclusions_bm' | 'is_popular'> & { inclusions: string; inclusions_bm: string; is_popular: number }

function fromRow<T extends Package>(r: Row<T>): T {
  return { ...r, inclusions: JSON.parse(r.inclusions) as string[], inclusions_bm: JSON.parse(r.inclusions_bm) as string[], is_popular: r.is_popular === 1 } as T
}

const SELECT_WITH_NAMES = `
  SELECT p.*, c.name AS cuisine_name, c.name_bm AS cuisine_name_bm, c.slug AS cuisine_slug,
    m.r2_key AS image_key, m.alt AS image_alt
  FROM packages p
  JOIN cuisines c ON c.id = p.cuisine_id
  LEFT JOIN media m ON m.id = p.image_id`

/**
 * Public listing: published packages whose cuisine is also published.
 * Both filters are optional (pass nothing for all published packages).
 * A service type filter also matches packages offered as 'both'.
 */
export async function listPublishedPackages(
  db: D1Database,
  filter: { serviceType?: Exclude<ServiceType, 'both'>; cuisineId?: number } = {},
): Promise<PackageWithNames[]> {
  const { results } = await db
    .prepare(
      `${SELECT_WITH_NAMES}
       WHERE p.status = 'published' AND c.status = 'published'
         AND (?1 IS NULL OR p.service_type IN (?1, 'both'))
         AND (?2 IS NULL OR p.cuisine_id = ?2)
       ORDER BY p.is_popular DESC, p.sort_order, p.price_sen, p.name`,
    )
    .bind(filter.serviceType ?? null, filter.cuisineId ?? null)
    .all<Row<PackageWithNames>>()
  return results.map(fromRow)
}

export async function getPublishedPackageBySlug(db: D1Database, slug: string): Promise<PackageWithNames | null> {
  const row = await db
    .prepare(
      `${SELECT_WITH_NAMES}
       WHERE p.slug = ? AND p.status = 'published' AND c.status = 'published'`,
    )
    .bind(slug)
    .first<Row<PackageWithNames>>()
  return row ? fromRow(row) : null
}

/** Admin listing: every package regardless of status. */
export async function listPackages(db: D1Database): Promise<PackageWithNames[]> {
  const { results } = await db
    .prepare(`${SELECT_WITH_NAMES} ORDER BY c.sort_order, p.sort_order, p.name`)
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
         (slug, cuisine_id, service_type, name, name_bm, price_sen, min_pax, max_pax,
          inclusions, inclusions_bm, is_popular, image_id, pdf_key, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      p.slug, p.cuisine_id, p.service_type, p.name, p.name_bm, p.price_sen, p.min_pax, p.max_pax,
      JSON.stringify(p.inclusions), JSON.stringify(p.inclusions_bm), p.is_popular ? 1 : 0, p.image_id, p.pdf_key, p.sort_order, p.status,
    )
    .first<{ id: number }>()
  return row!.id
}

export async function updatePackage(db: D1Database, id: number, p: PackageInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE packages SET
         slug = ?, cuisine_id = ?, service_type = ?, name = ?, name_bm = ?,
         price_sen = ?, min_pax = ?, max_pax = ?, inclusions = ?, inclusions_bm = ?, is_popular = ?, image_id = ?, pdf_key = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(
      p.slug, p.cuisine_id, p.service_type, p.name, p.name_bm, p.price_sen, p.min_pax, p.max_pax,
      JSON.stringify(p.inclusions), JSON.stringify(p.inclusions_bm), p.is_popular ? 1 : 0, p.image_id, p.pdf_key, p.sort_order, p.status, id,
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
