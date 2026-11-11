/// <reference lib="dom" />
// Enhancement only: the site works without this file.

// Header shadow once the page has scrolled.
const header = document.querySelector('.site-header')
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 0)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

// Data Saver on: stop the decorative hero video and show the poster instead.
const heroVideo = document.querySelector<HTMLVideoElement>('.hero-video')
if (heroVideo && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) {
  heroVideo.pause()
  heroVideo.hidden = true
  heroVideo.parentElement?.classList.add('hero--still')
}
