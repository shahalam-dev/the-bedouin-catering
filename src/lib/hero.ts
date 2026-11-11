// Home hero video files (Workers static assets in public/video/). /video/* is cached as immutable,
// so give a changed file a new name (.v2) instead of overwriting it.
export const HERO_VIDEO = {
  desktop: '/video/hero3-loop.v1.mp4',
  mobile: '/video/hero3-loop-mobile.v1.mp4',
  poster: '/video/hero3-poster.v1.webp',
} as const
