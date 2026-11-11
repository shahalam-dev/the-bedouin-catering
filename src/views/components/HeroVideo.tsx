import { HERO_VIDEO } from '../../lib/hero'

// Decorative looping background for the home hero.
export const HeroVideo = () => (
  <video
    class="hero-video"
    autoplay
    muted
    loop
    playsinline
    preload="metadata"
    poster={HERO_VIDEO.poster}
    aria-hidden="true"
    disablepictureinpicture=""
  >
    <source src={HERO_VIDEO.mobile} type="video/mp4" media="(max-width: 768px)" />
    <source src={HERO_VIDEO.desktop} type="video/mp4" />
  </video>
)
