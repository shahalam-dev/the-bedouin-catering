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
