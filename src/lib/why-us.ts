import type { Lang } from './i18n'

// "Why choose us" home section. Image is a Workers static asset in public/image/why-us/. Give a changed
// photo a new name (.v2) instead of overwriting it, so browsers don't keep the old cached copy.
// shortcut: unconfirmed claims (JAKIM, years, event count); confirm with the client before launch.
type T = Record<Lang, string>

export type WhyUsFeature = {
  icon: 'chef' | 'bell' | 'calendar' | 'leaf'
  stat: string
  title: T
  text: T
}

export const WHY_US = {
  // Cross-fades every 4s (public/js/why-us.js); without JS only the first shows.
  images: [
    {
      src: '/image/why-us/platter-1.v1.png',
      alt: {
        en: 'Top-down view of a herb salad with roasted roll, beetroot and edible flowers in a pink bowl',
        bm: 'Pandangan atas salad herba dengan roti panggang, bit dan bunga boleh dimakan dalam mangkuk merah jambu',
      },
    },
    {
      src: '/image/why-us/platter-2.v1.png',
      alt: {
        en: 'Top-down view of seared scallops with strawberries in a cream sauce on a textured white plate',
        bm: 'Pandangan atas kerang panggang dengan strawberi dalam sos krim di atas pinggan putih bertekstur',
      },
    },
    {
      src: '/image/why-us/platter-3.v1.png',
      alt: {
        en: 'Top-down view of three golden seared scallops with herbs in a butter sauce',
        bm: 'Pandangan atas tiga kerang panggang keemasan dengan herba dalam sos mentega',
      },
    },
  ] as { src: string; alt: T }[],
  ring: {
    en: 'Cooked fresh on the day · Klang Valley · Halal certified · ',
    bm: 'Dimasak segar pada hari majlis · Lembah Klang · Halal diperakui · ',
  } as T,
  badge: { stat: '1,000+', label: { en: 'Events', bm: 'Majlis' } as T },
  // Order is the mobile reading order; on desktop odd items sit left, even items right.
  features: [
    {
      icon: 'chef',
      stat: '20+',
      title: { en: 'Years in the Kitchen', bm: 'Tahun di Dapur' },
      text: {
        en: 'Our head chef trained in hotel kitchens and has cooked Arabic and Malay feasts for two decades.',
        bm: 'Ketua chef kami dilatih di dapur hotel dan telah memasak jamuan Arab dan Melayu selama dua dekad.',
      },
    },
    {
      icon: 'bell',
      stat: '5★',
      title: { en: 'Hotel-Standard Service', bm: 'Servis Standard Hotel' },
      text: {
        en: 'Led by a banquet manager with years in 5-star hotel F&B — the same timing and polish, at your venue.',
        bm: 'Diketuai pengurus bankuet berpengalaman di F&B hotel 5 bintang — ketepatan dan kemas yang sama, di lokasi anda.',
      },
    },
    {
      icon: 'calendar',
      stat: 'A–Z',
      title: { en: 'Full Event Planning', bm: 'Perancangan Majlis Penuh' },
      text: {
        en: 'Staffing, buffet styling, table dressing and clean-up — one team handles it all, so you can simply enjoy the day.',
        bm: 'Kakitangan, susunan bufet, hiasan meja dan pembersihan — satu pasukan uruskan semua, anda hanya perlu menikmati hari itu.',
      },
    },
    {
      icon: 'leaf',
      stat: '100%',
      title: { en: 'Halal & Fresh Ingredients', bm: 'Bahan Halal & Segar' },
      text: {
        en: 'Halal-certified kitchen, strict food-safety practice, and seasonal produce bought fresh for every event.',
        bm: 'Dapur diperakui halal, amalan keselamatan makanan yang ketat, dan bahan bermusim dibeli segar untuk setiap majlis.',
      },
    },
  ] as WhyUsFeature[],
  checks: [
    { en: 'JAKIM Halal certified', bm: 'Diperakui Halal JAKIM' },
    { en: 'Vegetarian & allergy-friendly options', bm: 'Pilihan vegetarian & mesra alahan' },
    { en: '30 to 2,000 guests', bm: '30 hingga 2,000 tetamu' },
  ] as T[],
}
