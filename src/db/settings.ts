import { changed } from './shared'

// Values are stored as JSON, so a setting can be a string, number, object or list.

export async function getSetting<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row ? (JSON.parse(row.value) as T) : null
}

export async function getAllSettings(db: D1Database): Promise<Record<string, unknown>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)]))
}

/** Insert or replace. Caller should purge cached pages / KV copies afterwards. */
export async function setSetting(db: D1Database, key: string, value: unknown): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    )
    .bind(key, JSON.stringify(value))
    .run()
}

export async function deleteSetting(db: D1Database, key: string): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run())
}
