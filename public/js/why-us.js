// Enhances the home "why choose us" photo: cross-fades to the next platter every 4s.
// Pauses while hovered; no auto-advance for reduced-motion users.
for (const root of document.querySelectorAll('[data-why-photos]')) {
  const photos = [...root.querySelectorAll('img')]
  if (photos.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) continue
  let cur = 0
  let paused = false
  root.addEventListener('mouseenter', () => (paused = true))
  root.addEventListener('mouseleave', () => (paused = false))
  setInterval(() => {
    if (paused || document.hidden) return
    const next = (cur + 1) % photos.length
    photos[next].loading = 'eager' // load before it fades in
    photos[cur].removeAttribute('data-active')
    photos[cur].setAttribute('aria-hidden', 'true')
    photos[next].setAttribute('data-active', '')
    photos[next].removeAttribute('aria-hidden')
    cur = next
  }, 4000)
}
