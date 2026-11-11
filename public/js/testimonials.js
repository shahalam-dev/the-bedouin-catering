// Enhances the home testimonials: in-page switching and auto-advance every few seconds.
// Pauses while hovered or focused; no auto-advance for reduced-motion users.
for (const root of document.querySelectorAll('[data-testimonials]')) {
  const slides = [...root.querySelectorAll('.testimonials__slide')]
  const items = [...root.querySelectorAll('.testimonials__item')]
  if (slides.length < 2) continue
  let cur = Math.max(0, slides.findIndex((s) => !s.hidden))

  const show = (i) => {
    i = (i + slides.length) % slides.length
    slides[cur].hidden = true
    items[cur]?.removeAttribute('aria-current')
    slides[i].hidden = false
    items[i]?.setAttribute('aria-current', 'true')
    cur = i
  }

  root.addEventListener('click', (e) => {
    const link = e.target.closest('[data-t-go]')
    if (!link) return
    e.preventDefault()
    const go = link.dataset.tGo
    show(go === 'prev' ? cur - 1 : go === 'next' ? cur + 1 : Number(go))
    // The clicked arrow was inside the slide we just hid; keep focus on the matching one.
    if (go === 'prev' || go === 'next') slides[cur].querySelector(`[data-t-go="${go}"]`).focus()
  })

  let timer
  const start = () => {
    if (!timer && !matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(cur + 1), 6000)
  }
  const stop = () => {
    clearInterval(timer)
    timer = undefined
  }
  root.addEventListener('mouseenter', stop)
  root.addEventListener('mouseleave', () => root.contains(document.activeElement) || start())
  root.addEventListener('focusin', stop)
  root.addEventListener('focusout', (e) => root.contains(e.relatedTarget) || root.matches(':hover') || start())
  start()
}
