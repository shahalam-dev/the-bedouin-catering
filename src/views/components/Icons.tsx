// Lucide line icons (1.5px stroke). Decorative: always aria-hidden.
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
} as const

export const CheckIcon = () => (
  <svg {...base}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const XIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const StarIcon = () => (
  <svg {...base}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

export const ChevronIcon = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg {...base}>
    <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
)

export const ChefHatIcon = () => (
  <svg {...base}>
    <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
    <path d="M6 17h12" />
  </svg>
)

export const BellIcon = () => (
  <svg {...base}>
    <path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z" />
    <path d="M20 16a8 8 0 1 0-16 0" />
    <path d="M12 4v4M10 4h4" />
  </svg>
)

export const CalendarCheckIcon = () => (
  <svg {...base}>
    <path d="M8 2v4M16 2v4M3 10h18" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="m9 16 2 2 4-4" />
  </svg>
)

export const LeafIcon = () => (
  <svg {...base}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
)
