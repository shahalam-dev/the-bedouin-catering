# Catering Design System

Bold crimson and black, warm hospitality, food as the hero. One system for the catering website and its CMS: an elegant serif for headings, a clean sans for everything you read, and an occasional decorative script.

---

## 1. Brand personality

- **Warm & generous.** Hospitality comes first, and the food is always the hero. Photography carries the page.
- **Bold & confident.** Strong crimson and black blocks with high contrast.
- **Elegant, not fussy.** Classic serif headings, simple layouts and generous white space.

## 2. Content & voice

- Write like a host, not a brochure: short, warm, direct sentences.
- Headings use **Title Case**. Section titles are centred and may highlight **one** word in crimson ("Welcome to **Our Kitchen**").
- Prices are always per pax, written `RM 35 / pax`, with the minimum pax beside them.
- Name occasions the way customers say them: Weddings, Corporate, Birthdays, Aqiqah, Open House.
- The site is bilingual-ready (an EN / BM switch is optional), so keep labels short enough for both languages.

---

## 3. Colour

### Core
| Token | Hex | Use |
|---|---|---|
| `primary` | `#A81E2B` | Crimson: header, footer, primary buttons, colour blocks, highlighted words. White text on it (7.3:1). |
| `primary-dark` | `#861721` | Button hover/pressed, borders on crimson, chip text on `primary-light` |
| `primary-light` | `#F6E4E6` | Selected states, subtle tints, badges, chips |
| `ink` | `#111111` | Headings, black section blocks, secondary buttons, labels, CMS sidebar |
| `body` | `#3A3634` | Body text |
| `muted` | `#7F6F61` | Captions, helper text, meta info (4.8:1 on white) |

### Surfaces
| Token | Hex | Use |
|---|---|---|
| `white` | `#FFFFFF` | Main background, cards |
| `cream` | `#FDF9EF` | Alternate warm section background |
| `grey-50` | `#F3F3F3` | Testimonials band, CMS background |
| `border` | `#E5E1DA` | Card borders, dividers, inputs, table rows |

### Accents (use sparingly)
| Token | Hex | Use |
|---|---|---|
| `saffron` | `#C44D24` | Price highlights, the "Popular" tag (white text, 4.7:1) |
| `sand` | `#D1B18D` | Decorative lines, icons on dark, photo placeholders. Not for text on white. |

### Status (CMS & forms)
| Token | Hex | Use |
|---|---|---|
| `success` | `#2E7D4F` | Success messages, Published status |
| `warning` | `#C98A1B` | Warnings, Hidden status. **Fails as text on white (2.9:1)**, so use it only as a dot, icon or fill with ink text. |
| `error` | `#C62828` | Input errors, destructive outline buttons |
| `info` | `#2F6FA3` | Informational notices |

### Special
| Token | Value | Use |
|---|---|---|
| `whatsapp` | `#25D366` | Floating WhatsApp button only |
| `overlay` | `rgba(0,0,0,0.55)` | Hero photo overlay so white text reads clearly |

**Rules**
- Text on `primary` or `ink` is always white.
- Balance each page at roughly **60%** white/cream, **30%** crimson/black blocks and **10%** accents.
- Never put crimson text on a black background.

---

## 4. Typography

| Role | Font | Weights | Fallback |
|---|---|---|---|
| Headings, prices, stats, buttons | **Cormorant Garamond** | 700 | Georgia, serif |
| Body / UI | **Montserrat** | 400, 500, 600 | Arial, sans-serif |
| Decorative script | **Pinyon Script** | 400 | cursive |

All three are Google Fonts:
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Montserrat:wght@400;500;600&family=Pinyon+Script&display=swap`

### Scale (desktop / mobile)
| Style | Size | Font / weight | Line height |
|---|---|---|---|
| Display (hero script) | 72 / 44px | Pinyon Script 400 | 1.1 |
| H1 | 48 / 34px | Cormorant 700 | 1.15 |
| H2 (section title) | 36 / 28px | Cormorant 700 | 1.2 |
| H3 (card title) | 24 / 20px | Cormorant 700 | 1.25 |
| H4 (dish name) | 18 / 17px | Cormorant 700 | 1.3 |
| Stat number | 48 / 36px | Cormorant 700 | 1 |
| Button | 18px | Cormorant 700 | 1 |
| Body L | 18 / 16px | Montserrat 400 | 1.6 |
| Body | 15 / 14px | Montserrat 400 | 1.6 |
| Caption | 13 / 12px | Montserrat 400 | 1.5 |
| Nav | 14px | Montserrat 500 (600 for emphasis) | 1 |
| Form label | 13px | Montserrat 500 | 1.4 |

**Rules**
- Use the script font **only** for the hero title and the occasion strip, never for body text or buttons.
- Section titles are centred, with an optional single crimson word.

---

## 5. Layout & spacing

- **Container:** max-width 1200px, side padding 24px (mobile 16px)
- **Grid:** 12 columns with a 24px gutter. Cards go 3-up on desktop, 2-up on tablet and 1-up on mobile.
- **Breakpoints:** mobile < 640 · tablet 640–1024 · desktop > 1024
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96px (`space-1` … `space-9`)
- **Section padding:** 96px vertical (mobile 56px)
- **Header height:** 72px
- **Minimum tap target:** 44px
- **Signature layout: 50/50 split blocks.** Crimson | photo or black | crimson side by side, stacked on mobile.

## 6. Shape, elevation & imagery

- **Radius:** 4px for buttons, tags, chips and inputs · 8px for cards and images · 12px for modals · full (9999px) for avatars and dish thumbnails
- **Shadows:**
  - card: `0 4px 16px rgba(17,17,17,0.08)`
  - card hover: `0 8px 24px rgba(17,17,17,0.14)`
  - sticky header: `0 2px 8px rgba(17,17,17,0.12)`
- **Photography:** warm, high-saturation food close-ups (steam, platters, shared tables). Use landscape for cards and circular crops for dish thumbnails.
- **Hero:** photo under the `overlay` scrim with white text.
- **Icons:** simple line icons, 1.5px stroke, 20–24px (Lucide works well). They take the surrounding text colour; on black blocks use sand or white. No filled icons, multicolour icons or emoji.

---

## 7. Components

### Header / nav
- Crimson bar, 72px high. Logo on the left, links centred (white Montserrat 500 14px), and a **white "Get a Quote" button** with crimson text on the right. An EN / BM switch is optional.
- Sticky on scroll; adds the header shadow once the page has scrolled.
- Mobile: logo + hamburger, opening a full-screen crimson menu.

### Buttons
| Variant | Style |
|---|---|
| Primary | Crimson bg, white text; hover `primary-dark` |
| Secondary | Black bg, white text (on crimson blocks) |
| Inverse | White bg, crimson text (on crimson header/blocks) |
| Outline | 1.5px crimson border, crimson text, transparent bg |
| Danger (CMS) | 1.5px `error` border and text, transparent bg |
| WhatsApp | 56px floating circle, `#25D366`, bottom-right, line chat icon |

All buttons: 4px radius, 12×24px padding, Cormorant Garamond 700 18px, min height 44px, 200ms ease-out transitions.

### Image category card *(signature)*
- Rounded photo (8px) with a **label tag overlapping the bottom edge**. The tag is a small crimson or black rectangle (4px radius) with white Cormorant 700 text ("Corporate", "Wedding", "Buffet").
- Featured variant: the photo sits inside a crimson frame with a white title below.

### Package card
- White card with a 1px border and the card shadow; it lifts 4px on hover.
- Order:
  1. photo
  2. name (H3)
  3. cuisine + branch chips (`primary-light` bg, `primary-dark` text)
  4. **price per pax** (Cormorant 700, crimson, "RM 35 / pax")
  5. min pax (muted)
  6. 3–5 inclusion bullets with crimson check icons
  7. primary "Select" / "Enquire" button
- Popular packages get a saffron "Popular" tag in the top-left corner.

### Menu card (dish)
- **Grid style:** photo, dish name (H4), 2-line description (caption), price right-aligned in crimson.
- **List style:** circular 72px thumbnail with a 3px white border, name and description beside it. Used on crimson "Bestsellers" blocks with white text.

### Package selector (branch → cuisine → package)
- **Stepper:** three 32px numbered circles joined by a line. The active step is a crimson fill with a white number; done steps have a crimson outline and check; upcoming steps have a muted outline. The connector line turns crimson once a step is done.
- **Options:** large selectable image cards. The selected card gets a 2px crimson border, a `primary-light` tint and a crimson check badge in the top-right corner.
- **Previous selections:** removable chips above the options ("Branch: Shah Alam ×").
- **Mobile:** a sticky bottom bar with "Back" (outline) and "Next" (primary) buttons.

### Stat card
- Small white card with the card shadow: a big Cormorant 700 number (48px, ink) and a Montserrat 500 13px muted caption below it ("50+ Packages", "3 Branches", "1,000+ Events").

### Occasion strip
- A full-width marquee of occasions in crimson Pinyon Script, separated by middle dots: "Weddings · Corporate · Birthdays · Aqiqah · Open House".
- Thin sand rules above and below.
- Scrolls slowly and continuously, pauses on hover, and stops under `prefers-reduced-motion`.
- Duplicate the list inside the track so the loop is seamless.

### Testimonial card
- Sits on the grey-50 band. White card with the card shadow containing five crimson stars, the quote in Body L italic, the customer name in Cormorant 700 and the event type as a muted caption.

### Forms
- **Inputs:** 48px high, white, 1px `border`, 4px radius, Montserrat 15px. The label sits above in Montserrat 500 13px ink.
- **Focus:** 2px crimson ring. **Error:** red border plus a red helper message below.
- **Enquiry fields:** name, phone, email, event date, pax, branch, cuisine, package, message.

### Footer
- Crimson background with a centred white logo, a short description, links separated by thin white vertical dividers, line social icons, and the copyright at 12px.

### CMS (admin)
- Same fonts and colours in a calmer layout: a grey-50 background, white content panels, and a **black sidebar** whose active item is crimson.
- **Tables:** white, 1px row borders, cream hover tint, Edit / Delete actions right-aligned.
- **Status pills:** a coloured dot with ink text. Published = success, Draft = muted, Hidden = warning.
- **Actions:** primary actions use the crimson button; destructive actions use the red outline button.

---

## 8. Motion

- 200ms ease-out for hovers and button states; cards lift 4px on hover.
- Sections fade up 16px on scroll, once.
- The occasion strip scrolls slowly and continuously and pauses on hover.
- Respect `prefers-reduced-motion`: no lifts, fades or marquee.

## 9. Accessibility

- Body text contrast at least 4.5:1. Crimson on white passes (7.3:1) for text and buttons, and muted passes (4.8:1).
- Every food image has descriptive alt text ("Lamb mandi on a shared platter with saffron rice").
- Visible focus ring on all interactive elements: 2px crimson with a 2px offset.
- Minimum tap target is 44px.

---

## 10. CSS tokens

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Montserrat:wght@400;500;600&family=Pinyon+Script&display=swap');

:root {
  /* Core */
  --primary: #a81e2b;
  --primary-dark: #861721;
  --primary-light: #f6e4e6;
  --ink: #111111;
  --body: #3a3634;
  --muted: #7f6f61;

  /* Surfaces */
  --white: #ffffff;
  --cream: #fdf9ef;
  --grey-50: #f3f3f3;
  --border: #e5e1da;

  /* Accents */
  --saffron: #c44d24;
  --sand: #d1b18d;

  /* Status */
  --success: #2e7d4f;
  --warning: #c98a1b;
  --error: #c62828;
  --info: #2f6fa3;

  /* Special */
  --whatsapp: #25d366;
  --overlay: rgba(0, 0, 0, 0.55);

  /* Fonts */
  --font-serif: "Cormorant Garamond", Georgia, serif;
  --font-sans: Montserrat, Arial, sans-serif;
  --font-script: "Pinyon Script", cursive;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card: 0 4px 16px rgba(17, 17, 17, 0.08);
  --shadow-card-hover: 0 8px 24px rgba(17, 17, 17, 0.14);
  --shadow-header: 0 2px 8px rgba(17, 17, 17, 0.12);

  /* Layout */
  --container-max: 1200px;
  --header-height: 72px;
  --section-pad: 96px;
  --section-pad-mobile: 56px;
  --tap-min: 44px;

  /* Motion */
  --ease: 200ms ease-out;
}
```

## 11. Tailwind config (optional)

```js
// tailwind.config.js — theme.extend
{
  colors: {
    primary: { DEFAULT: '#A81E2B', dark: '#861721', light: '#F6E4E6' },
    ink: '#111111', body: '#3A3634', muted: '#7F6F61',
    cream: '#FDF9EF', 'grey-50': '#F3F3F3', border: '#E5E1DA',
    saffron: '#C44D24', sand: '#D1B18D',
    success: '#2E7D4F', warning: '#C98A1B', error: '#C62828', info: '#2F6FA3',
    whatsapp: '#25D366',
  },
  fontFamily: {
    serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
    sans: ['Montserrat', 'Arial', 'sans-serif'],
    script: ['"Pinyon Script"', 'cursive'],
  },
  borderRadius: { sm: '4px', md: '8px', lg: '12px' },
  boxShadow: {
    card: '0 4px 16px rgba(17,17,17,0.08)',
    'card-hover': '0 8px 24px rgba(17,17,17,0.14)',
    header: '0 2px 8px rgba(17,17,17,0.12)',
  },
  maxWidth: { container: '1200px' },
  screens: { tablet: '640px', desktop: '1024px' },
}
```