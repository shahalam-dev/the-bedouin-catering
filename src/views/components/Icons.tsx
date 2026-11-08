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
