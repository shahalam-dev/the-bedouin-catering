import type { Lang } from './i18n'

// Team photos are Workers static assets in public/image/. Give a changed photo a new name (.v2)
// instead of overwriting it, so browsers don't keep the old cached copy.
// shortcut: placeholder names and bios; replace with the real team before launch.
export type TeamMember = {
  name: string
  image: string
  role: Record<Lang, string>
  bio: Record<Lang, string>
}

export const TEAM: TeamMember[] = [
  {
    name: 'Ahmad Faizal',
    image: '/image/team-1-male.v1.webp',
    role: { en: 'Founder & Head Chef', bm: 'Pengasas & Ketua Chef' },
    bio: {
      en: 'Twenty years of cooking Arabic and Malay feasts, from family kenduri to grand weddings.',
      bm: 'Dua puluh tahun memasak jamuan Arab dan Melayu, dari kenduri keluarga hingga majlis perkahwinan besar.',
    },
  },
  {
    name: 'Nur Aisyah',
    image: '/image/team-2-female.v1.webp',
    role: { en: 'Events Manager', bm: 'Pengurus Majlis' },
    bio: {
      en: 'Plans every detail with you, from menu tasting to the last plate served on the day.',
      bm: 'Merancang setiap butiran bersama anda, dari rasa menu hingga hidangan terakhir pada hari majlis.',
    },
  },
  {
    name: 'Hafiz Rahman',
    image: '/image/team-3-male.v1.webp',
    role: { en: 'Operations Lead', bm: 'Ketua Operasi' },
    bio: {
      en: 'Leads our service crew so the food arrives hot, on time and beautifully set up.',
      bm: 'Mengetuai krew kami supaya makanan tiba panas, tepat pada masa dan tersusun cantik.',
    },
  },
]
