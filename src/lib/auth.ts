import type { MiddlewareHandler } from 'hono'
import { verifyWithJwks } from 'hono/jwt'

export type AdminEnv = { Bindings: Env; Variables: { adminEmail: string } }

// Read as plain strings: wrangler types the empty placeholders as "", and ADMIN_DEV_EMAIL exists only in .dev.vars.
type AccessConfig = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; ADMIN_DEV_EMAIL?: string }

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Guards /admin/*. Cloudflare Access sits in front of the site and adds a signed JWT to each request;
 * we verify it here too, so the admin stays closed if Access is misconfigured or bypassed (e.g. workers.dev).
 */
export const requireAdmin: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const cfg = c.env as unknown as AccessConfig

  // Local dev has no Access in front of it. Honoured on localhost only, so a stray prod value does nothing.
  if (cfg.ADMIN_DEV_EMAIL && LOCAL_HOSTS.has(new URL(c.req.url).hostname)) {
    c.set('adminEmail', cfg.ADMIN_DEV_EMAIL)
    return next()
  }

  const team = cfg.ACCESS_TEAM_DOMAIN
  const aud = cfg.ACCESS_AUD
  if (!team || !aud) return c.text('Admin access is not configured.', 503)

  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) return c.text('Unauthorized', 401)

  try {
    const payload = await verifyWithJwks(
      token,
      {
        jwks_uri: `https://${team}/cdn-cgi/access/certs`,
        allowedAlgorithms: ['RS256'],
        verification: { iss: `https://${team}`, aud },
      },
      // Access keys rotate rarely and old keys stay valid for a while after, so an hour of edge cache is safe.
      { cf: { cacheTtl: 3600, cacheEverything: true } },
    )
    if (typeof payload.email !== 'string') return c.text('Unauthorized', 401)
    c.set('adminEmail', payload.email)
  } catch {
    return c.text('Unauthorized', 401)
  }
  return next()
}
