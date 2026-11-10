// Shared by the per-table query files. Not a table.

export type Status = 'published' | 'draft' | 'hidden'

/** True when a write touched at least one row. */
export const changed = (r: D1Result) => (r.meta.changes ?? 0) > 0

/** Card photo from the media table; both null when the row has no image. */
export type WithImage = { image_key: string | null; image_alt: string | null }

