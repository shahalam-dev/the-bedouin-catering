import { createMedia, type MediaFolder } from '../db/media'

// Fixed sizes served by /img/:preset/:key. Only these exist, so nobody can request
// arbitrary widths and burn transformation quota.
export const IMAGE_WIDTHS = { thumb: 400, card: 800, hero: 1600 } as const

export type ImagePreset = keyof typeof IMAGE_WIDTHS

export const imgUrl = (key: string, preset: ImagePreset) => `/img/${preset}/${key}`

/**
 * Re-encodes an upload as WebP, at most 2000px on the longest side (never upscaled).
 * Re-encoding drops EXIF/GPS metadata. Throws if the binding fails.
 */
export async function toWebp(images: ImagesBinding, file: File): Promise<ArrayBuffer> {
  const out = await images
    .input(file.stream())
    .transform({ width: 2000, height: 2000, fit: 'scale-down' })
    .output({ format: 'image/webp', quality: 82 })
  return out.response().arrayBuffer()
}

/** Cloudflare Images error code (e.g. 9422 = usage limit), from ImagesError.code or the message. */
export function imagesErrorCode(e: unknown): number | undefined {
  if (e instanceof Error && 'code' in e && typeof e.code === 'number') return e.code
  const m = /\b(9\d{3})\b/.exec(e instanceof Error ? e.message : String(e))
  return m ? Number(m[1]) : undefined
}

// Codes that mean the file itself is bad (not an image, too large, unsupported format),
// so retrying will not help.
const BAD_INPUT_CODES = new Set([9412, 9413, 9520, 9522])

export const isBadImageError = (e: unknown) => BAD_INPUT_CODES.has(imagesErrorCode(e) ?? 0)

/**
 * Re-encodes an upload to WebP, stores it in R2 under `<folder>/` and adds its media row.
 * Returns the media id, or why conversion failed (nothing is stored then).
 */
export async function storeUpload(
  env: Env,
  folder: MediaFolder,
  file: File,
  alt: string,
): Promise<number | 'unreadable' | 'unavailable'> {
  // Only the re-encoded WebP is stored, never the original (this also drops EXIF/GPS).
  let webp: ArrayBuffer
  try {
    webp = await toWebp(env.IMAGES, file)
  } catch (e) {
    console.error('upload: image conversion failed', { code: imagesErrorCode(e), error: String(e) })
    return isBadImageError(e) ? 'unreadable' : 'unavailable'
  }
  // A new random key per upload, so /media and /img can cache it forever.
  const key = `${folder}/${crypto.randomUUID()}.webp`
  await env.MEDIA.put(key, webp, { httpMetadata: { contentType: 'image/webp' } })
  try {
    return await createMedia(env.DB, { r2_key: key, folder, alt, content_type: 'image/webp', size_bytes: webp.byteLength, width: null, height: null })
  } catch (e) {
    // Do not leave an object no row points to.
    await env.MEDIA.delete(key)
    throw e
  }
}
