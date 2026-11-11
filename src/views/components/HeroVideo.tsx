// Decorative looping background for the home hero. Files are Workers static assets in public/video/
// (bump the .v1 suffix when a file changes: /video/* is cached as immutable).
export const HERO_POSTER = '/video/hero2-poster.v1.webp'

export const HeroVideo = () => (
  <video
    class="hero-video"
    autoplay
    muted
    loop
    playsinline
    preload="metadata"
    poster={HERO_POSTER}
    aria-hidden="true"
    disablepictureinpicture=""
  >
    <source src="/video/hero2-loop-mobile.v1.mp4" type="video/mp4" media="(max-width: 768px)" />
    <source src="/video/hero2-loop.v1.mp4" type="video/mp4" />
  </video>
)
