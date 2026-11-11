// Shared by the per-table query files. Not a table.
import type { Lang } from '../lib/i18n'

export type Status = 'published' | 'draft' | 'hidden'

/** True when a write touched at least one row. */
export const changed = (r: D1Result) => (r.meta.changes ?? 0) > 0

/** Card photo from the media table; both null when the row has no image. */
export type WithImage = { image_key: string | null; image_alt: string | null }


type Bilingual = { name: string; name_bm: string | null; description: string | null; description_bm: string | null }

/** Name and description in the visitor's language; BM falls back to English when not filled in. */
export const inLang = <T extends Bilingual>(row: T, lang: Lang): T =>
  lang === 'bm' ? { ...row, name: row.name_bm || row.name, description: row.description_bm || row.description } : row
