/// <reference lib="dom" />
// Enhancement only: the site works without this file.
import { formatRM } from './lib/format'

// Header shadow once the page has scrolled.
const header = document.querySelector('.site-header')
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 0)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

// Hero video. `.hero--static` swaps it for the poster (one fallback path, see components.css).
const heroVideo = document.querySelector<HTMLVideoElement>('.hero-video')
const hero = heroVideo?.parentElement
if (heroVideo && hero) {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (saveData || reducedMotion) {
    // Never play: stop the autoplay attribute and show the poster.
    heroVideo.pause()
    hero.classList.add('hero--static')
  } else {
    // Autoplay can be blocked (iOS Low Power Mode): show the poster, retry on the next gesture.
    const play = () => {
      heroVideo.muted = true // autoplay is only allowed when muted
      heroVideo.play().then(
        () => hero.classList.remove('hero--static'),
        () => {
          hero.classList.add('hero--static')
          const retry = new AbortController()
          const onGesture = () => {
            retry.abort() // one retry for whichever event fires first (iOS counts touchend as the gesture)
            play()
          }
          for (const type of ['touchstart', 'touchend', 'pointerdown', 'scroll']) {
            window.addEventListener(type, onGesture, { once: true, passive: true, signal: retry.signal })
          }
        },
      )
    }
    // iOS pauses the video when the tab is backgrounded.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && heroVideo.paused && !hero.classList.contains('hero--static')) play()
    })
    if (document.readyState === 'complete') play()
    else window.addEventListener('load', play, { once: true })
  }
}

// Package selector, details step: live estimate (price per pax x guests). The server saves its own figure.
const estimate = document.querySelector<HTMLElement>('[data-estimate]')
const paxInput = document.querySelector<HTMLInputElement>('#pax')
const estimateValue = estimate?.querySelector('[data-estimate-value]')
if (estimate && paxInput && estimateValue) {
  const price = Number(estimate.dataset.estimate)
  const update = () => {
    const pax = Number(paxInput.value)
    estimateValue.textContent =
      Number.isInteger(pax) && pax > 0
        ? (estimate.dataset.template ?? '').replace('{total}', formatRM(price * pax)).replace('{n}', String(pax))
        : (estimate.dataset.hint ?? '')
  }
  paxInput.addEventListener('input', update)
}
