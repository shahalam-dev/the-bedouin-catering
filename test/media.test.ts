import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
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

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAALElEQVR4nO3NMQ0AAAgDsCnhxr8KZCEDjib9m6k+EbFYLBaLxWKxWCwW/40XH5zx3XTu5yYAAAAASUVORK5CYII='),
  (ch) => ch.charCodeAt(0),
)

describe('/img/:preset/:key', () => {
  const req = async (path: string, accept = '', e: Env = env) => {
    const ctx = createExecutionContext()
    const res = await app.request(path, { headers: { Accept: accept } }, e, ctx)
    await waitOnExecutionContext(ctx)
    return res
  }

  it('serves AVIF or WebP by Accept header, with long cache headers, and caches each format', async () => {
    // An old-style PNG key: still served (converted) until it is migrated.
    await env.MEDIA.put('gallery/old.png', PNG, { httpMetadata: { contentType: 'image/png' } })
    const avif = await req('/img/card/gallery/old.png', 'image/avif,image/webp,*/*')
    expect(avif.status).toBe(200)
    expect(avif.headers.get('Content-Type')).toBe('image/avif')
    expect(avif.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(avif.headers.get('Vary')).toBe('Accept')

    const webp = await req('/img/card/gallery/old.png', 'image/webp,*/*')
    expect(webp.headers.get('Content-Type')).toBe('image/webp')

    const cache = (caches as unknown as { default: Cache }).default
    expect(await cache.match('http://localhost/img/card/gallery/old.png?f=avif')).toBeDefined()
    expect(await cache.match('http://localhost/img/card/gallery/old.png?f=webp')).toBeDefined()
  })

  it('404s for unknown presets, missing objects and keys outside the upload folders', async () => {
    await env.MEDIA.put('menu/a.webp', PNG)
    expect((await req('/img/huge/menu/a.webp')).status).toBe(404)
    expect((await req('/img/constructor/menu/a.webp')).status).toBe(404)
    expect((await req('/img/thumb/menu/missing.webp')).status).toBe(404)
    expect((await req('/img/thumb/private/a.webp')).status).toBe(404)
  })

  it('falls back to the stored file when the transform fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await env.MEDIA.put('menu/fallback.webp', 'stored', { httpMetadata: { contentType: 'image/webp' } })
    const failing = { input: () => { throw Object.assign(new Error('9422'), { code: 9422 }) } } as unknown as ImagesBinding
    const res = await req('/img/thumb/menu/fallback.webp', 'image/avif', { ...env, IMAGES: failing })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
    expect(await res.text()).toBe('stored')
    vi.restoreAllMocks()
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
