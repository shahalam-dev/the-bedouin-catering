/**
 * Server-side Turnstile check (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
 * Fails closed: a missing secret, missing token or network error all count as "not verified".
 */
export async function verifyTurnstile(secret: string | undefined, token: string, ip: string | undefined): Promise<boolean> {
  if (!secret || !token) return false
  const body = new FormData()
  body.append('secret', secret)
  body.append('response', token)
  if (ip) body.append('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    if (!res.ok) return false
    const data = await res.json<{ success?: boolean }>()
    return data.success === true
  } catch {
    return false
  }
}
