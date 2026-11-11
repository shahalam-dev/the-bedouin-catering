import { Hono } from 'hono'

// Hero videos in public/video/ reach the Worker first (assets.run_worker_first) because Workers static
// assets ignore Range, and Safari won't play video without 206 responses. Hono answers HEAD via this GET route.
const video = new Hono<{ Bindings: Env }>()

// Set here, not in public/_headers: a /video/* rule there would also mark 404s immutable.
// File names carry a version (.v1), so immutable is safe.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** Single byte range → [start, end] inclusive; 'unsatisfiable' → 416; null → ignore Range, send full file. */
export function parseRange(header: string, size: number): [number, number] | 'unsatisfiable' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim()) // also rejects multiple ranges (commas)
  if (!m || (m[1] === '' && m[2] === '')) return null
  if (m[1] === '') {
    const suffix = Number(m[2])
    if (suffix === 0 || size === 0) return 'unsatisfiable'
    return [Math.max(0, size - suffix), size - 1]
  }
  const start = Number(m[1])
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (start >= size || Number(m[2] || size) < start) return 'unsatisfiable'
  return [start, end]
}

video.get('/*', async (c) => {
  const headers = new Headers(c.req.raw.headers)
  headers.delete('Range')
  const asset = await c.env.ASSETS.fetch(new Request(c.req.url, { headers }))
  if (asset.status !== 200) return asset // 404 and 304 pass through unchanged

  const res = new Headers(asset.headers)
  res.set('Accept-Ranges', 'bytes')
  res.set('Cache-Control', CACHE_CONTROL)

  const rangeHeader = c.req.header('Range')
  if (!rangeHeader) return new Response(asset.body, { status: 200, headers: res })

  // Files are small (≤ 25 MiB, the static asset limit), so buffering is fine.
  const body = await asset.arrayBuffer()
  const size = body.byteLength
  const range = parseRange(rangeHeader, size)
  if (range === null) {
    res.set('Content-Length', String(size))
    return new Response(body, { status: 200, headers: res })
  }
  if (range === 'unsatisfiable') {
    res.set('Content-Range', `bytes */${size}`)
    res.delete('Content-Length')
    return new Response(null, { status: 416, headers: res })
  }
  const [start, end] = range
  res.set('Content-Range', `bytes ${start}-${end}/${size}`)
  res.set('Content-Length', String(end - start + 1))
  return new Response(body.slice(start, end + 1), { status: 206, headers: res })
})

export default video
