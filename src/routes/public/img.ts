import { Hono } from 'hono'
import { IMAGE_WIDTHS, imagesErrorCode, type ImagePreset } from '../../lib/images'

// Resized AVIF/WebP versions of R2 uploads, in fixed presets only. Works for old JPG/PNG keys too.
const img = new Hono<{ Bindings: Env }>()

img.get('/:preset/:key{(?:packages|menu|gallery|cuisines|branches|occasions)/[^/]+}', async (c) => {
  const preset = c.req.param('preset')
  if (!Object.hasOwn(IMAGE_WIDTHS, preset)) return c.notFound()
  const key = c.req.param('key')
  const format = (c.req.header('Accept') ?? '').includes('image/avif') ? 'image/avif' : 'image/webp'

  // Format is part of the cache key, so AVIF and WebP are cached separately.
  const cacheKey = new Request(new URL(`/img/${preset}/${key}?f=${format.slice(6)}`, c.req.url))
  // Cast: the DOM lib referenced by src/client.ts hides the Workers type for caches.default.
  const cache = (caches as unknown as { default: Cache }).default
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const obj = await c.env.MEDIA.get(key)
  if (!obj) return c.notFound()

  try {
    const out = await c.env.IMAGES.input(obj.body)
      .transform({ width: IMAGE_WIDTHS[preset as ImagePreset], fit: 'scale-down' })
      .output({ format, quality: 80 })
    // Keys are unique per upload and never overwritten, so a year-long immutable cache is safe.
    const res = out.response({
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable', Vary: 'Accept', 'X-Content-Type-Options': 'nosniff' },
    })
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()))
    return res
  } catch (e) {
    // e.g. 9422 (transformation limit): serve the stored file as-is so pages never show broken images.
    console.error('img transform failed', { key, preset, code: imagesErrorCode(e), error: String(e) })
    const orig = await c.env.MEDIA.get(key) // the first body was consumed by the transform
    if (!orig) return c.notFound()
    const headers = new Headers()
    orig.writeHttpMetadata(headers)
    // Short cache and not stored in caches.default, so the transform is retried soon.
    headers.set('Cache-Control', 'public, max-age=300')
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(orig.body, { headers })
  }
})

export default img
