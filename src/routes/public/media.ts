import { Hono } from 'hono'

// Serves admin-uploaded images from R2. Only the upload folders are exposed.
const media = new Hono<{ Bindings: Env }>()

media.get('/:key{(?:packages|menu|gallery|cuisines)/[^/]+}', async (c) => {
  const obj = await c.env.MEDIA.get(c.req.param('key'), { onlyIf: c.req.raw.headers })
  if (!obj) return c.notFound()

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('ETag', obj.httpEtag)
  // Upload keys must be unique per file (never overwritten), so a year-long immutable cache is safe.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')

  // No body means an If-None-Match / If-Modified-Since precondition matched.
  return 'body' in obj ? new Response(obj.body, { headers }) : new Response(null, { status: 304, headers })
})

export default media
