import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import app from '../src/index'
import { HERO_VIDEO } from '../src/lib/hero'

const SIZE = 5000
const FILE = Uint8Array.from({ length: SIZE }, (_, i) => i % 256)
const PATH: string = HERO_VIDEO.desktop

// Fake ASSETS binding: serves FILE at PATH, 404 elsewhere, and records whether Range reached it.
let sawRange = false
const ASSETS = {
  fetch: async (req: Request) => {
    sawRange ||= req.headers.has('Range')
    return new URL(req.url).pathname === PATH
      ? new Response(FILE, { headers: { 'Content-Type': 'video/mp4', ETag: '"abc"' } })
      : new Response('Not found', { status: 404 })
  },
} as unknown as Fetcher
const testEnv = { ...env, ASSETS } as Env

const get = (range?: string, method = 'GET', path = PATH) =>
  app.request(path, { method, headers: range ? { Range: range } : {} }, testEnv)

describe('/video/*', () => {
  it('returns the full file with cache and range headers when there is no Range', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('Content-Type')).toBe('video/mp4')
    expect(res.headers.get('ETag')).toBe('"abc"')
    expect((await res.arrayBuffer()).byteLength).toBe(SIZE)
  })

  it('serves bytes=0-1023 as 206 with 1024 bytes', async () => {
    sawRange = false
    const res = await get('bytes=0-1023')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe(`bytes 0-1023/${SIZE}`)
    expect(res.headers.get('Content-Length')).toBe('1024')
    expect(res.headers.get('Cache-Control')).toContain('immutable')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE.slice(0, 1024))
    expect(sawRange).toBe(false) // Range is stripped before the asset fetch
  })

  it('serves an open-ended range to the end of the file', async () => {
    const res = await get('bytes=4000-')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe(`bytes 4000-4999/${SIZE}`)
  })

  it('serves bytes=-500 as the last 500 bytes', async () => {
    const res = await get('bytes=-500')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe(`bytes 4500-4999/${SIZE}`)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE.slice(SIZE - 500))
  })

  it('answers 416 for a range past the end', async () => {
    const res = await get('bytes=999999999-')
    expect(res.status).toBe(416)
    expect(res.headers.get('Content-Range')).toBe(`bytes */${SIZE}`)
  })

  it('ignores multiple ranges and sends the full file', async () => {
    const res = await get('bytes=0-10,20-30')
    expect(res.status).toBe(200)
    expect((await res.arrayBuffer()).byteLength).toBe(SIZE)
  })

  it('answers HEAD with a range as 206 with no body', async () => {
    const res = await get('bytes=0-1023', 'HEAD')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe(`bytes 0-1023/${SIZE}`)
    expect(res.body).toBeNull()
  })

  it('passes 404s through unchanged', async () => {
    const res = await get('bytes=0-10', 'GET', '/video/missing.mp4')
    expect(res.status).toBe(404)
    expect(res.headers.get('Accept-Ranges')).toBeNull()
  })
})
