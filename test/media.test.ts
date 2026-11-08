import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import app from '../src/index'

describe('/media/:key', () => {
  it('serves an R2 object with long cache headers and supports 304', async () => {
    await env.MEDIA.put('menu/kabsa.jpg', 'img', { httpMetadata: { contentType: 'image/jpeg' } })
    const res = await app.request('/media/menu/kabsa.jpg', {}, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toContain('immutable')
    expect(await res.text()).toBe('img')

    const again = await app.request('/media/menu/kabsa.jpg', { headers: { 'If-None-Match': res.headers.get('ETag')! } }, env)
    expect(again.status).toBe(304)
  })

  it('404s for missing objects and keys outside the upload folders', async () => {
    await env.MEDIA.put('private/secret.txt', 'x')
    expect((await app.request('/media/menu/missing.jpg', {}, env)).status).toBe(404)
    expect((await app.request('/media/private/secret.txt', {}, env)).status).toBe(404)
  })
})

describe('404 page', () => {
  it('renders the branded page in the chosen language', async () => {
    const res = await app.request('/no-such-page?lang=bm', {}, env)
    expect(res.status).toBe(404)
    const html = await res.text()
    expect(html).toContain('Halaman Tidak Dijumpai')
    expect(html).toContain('href="/?lang=bm"')
  })
})
