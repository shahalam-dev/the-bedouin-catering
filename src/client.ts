/// <reference lib="dom" />
// Enhancement only: the site works without this file.

// Header shadow once the page has scrolled.
const header = document.querySelector('.site-header')
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 0)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()
