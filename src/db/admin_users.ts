import { changed } from './shared'

/** Safe to pass to views: never includes the password hash. */
export type AdminUser = {
  id: number
  email: string
  name: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

type Row = Omit<AdminUser, 'is_active'> & { is_active: number }
const fromRow = ({ is_active, ...r }: Row): AdminUser => ({ ...r, is_active: is_active === 1 })

const PUBLIC_COLUMNS = 'id, email, name, is_active, last_login_at, created_at'

export async function listAdminUsers(db: D1Database): Promise<AdminUser[]> {
  const { results } = await db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM admin_users ORDER BY name`).all<Row>()
  return results.map(fromRow)
}

export async function getAdminUserById(db: D1Database, id: number): Promise<AdminUser | null> {
  const row = await db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM admin_users WHERE id = ?`).bind(id).first<Row>()
  return row ? fromRow(row) : null
}

/** For login only: returns the hash of an active user. Email match is case-insensitive. */
export async function getActiveAdminForLogin(
  db: D1Database,
  email: string,
): Promise<{ user: AdminUser; password_hash: string } | null> {
  const row = await db
    .prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM admin_users WHERE email = ? AND is_active = 1`)
    .bind(email)
    .first<Row & { password_hash: string }>()
  if (!row) return null
  const { password_hash, ...user } = row
  return { user: fromRow(user), password_hash }
}

/** `passwordHash` must already be hashed (see src/lib/auth.ts). */
export async function createAdminUser(
  db: D1Database,
  u: { email: string; name: string; passwordHash: string },
): Promise<number> {
  const row = await db
    .prepare('INSERT INTO admin_users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id')
    .bind(u.email, u.name, u.passwordHash)
    .first<{ id: number }>()
  return row!.id
}

export async function updateAdminPassword(db: D1Database, id: number, passwordHash: string): Promise<boolean> {
  return changed(await db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(passwordHash, id).run())
}

export async function setAdminActive(db: D1Database, id: number, active: boolean): Promise<boolean> {
  return changed(await db.prepare('UPDATE admin_users SET is_active = ? WHERE id = ?').bind(active ? 1 : 0, id).run())
}

export async function recordAdminLogin(db: D1Database, id: number): Promise<boolean> {
  const r = await db
    .prepare("UPDATE admin_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(id)
    .run()
  return changed(r)
}
