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
