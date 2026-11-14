# Catering Website + CMS

Public catering website (packages, menu, occasions, package selector + enquiry form) plus an admin CMS for the client's staff.
Everything runs on Cloudflare: one Worker built with Hono, server-rendered with `hono/jsx`.

## Stack (do not swap without asking)
- Runtime: Cloudflare Workers (`wrangler.jsonc`), Vite via `@cloudflare/vite-plugin`
- Framework: Hono. UI: `hono/jsx`, rendered on the server. **No React**: no `react`, `react-dom` or `className` (use `class`).
- Data: D1 (SQLite). Media: R2. Sessions and cached settings: KV.
- Validation: `zod` + `@hono/zod-validator` on every form and API input.
- Spam protection: Cloudflare Turnstile on the public enquiry form.
- Language: TypeScript, strict mode. Package manager: npm.

## Commands
- `npm run dev` — local dev (local D1/R2/KV emulation)
- `npm run deploy` — deploy to Cloudflare
- `npx wrangler types` — regenerate binding types after any change to `wrangler.jsonc`
- `npx wrangler d1 migrations create catering-db <name>` — new migration
- `npx wrangler d1 migrations apply catering-db --local` (add `--remote` for production; ask before running remote)
- `npm run typecheck` / `npm test` — run both before saying a task is done

## Layout
```
src/
  index.tsx            # Hono app: mounts routes, middleware, error handler
  routes/
    public/            # home, package selector, menu, occasions, contact
    admin/             # CMS pages (behind auth)
    api/               # enquiry POSTs (contact message, selector booking), image upload
  views/
    layouts/           # PublicLayout, AdminLayout (jsxRenderer)
    components/        # Header, Footer, PackageCard, CategoryCard, MenuCard, Stepper, FormField, StatusPill...
  db/                  # one file per table: typed query functions using prepared statements
  lib/                 # auth, validation schemas, image helpers, email
  styles/tokens.css    # design tokens from docs/design-system.md, as CSS variables
migrations/            # D1 SQL migrations (never edit an applied one; add a new one)
docs/design-system.md  # the visual spec: colours, type, components. Follow it for all UI.
```

## Architecture rules
- One Worker serves both the public site and `/admin`. Public pages are cacheable; admin pages never are.
- Bindings: `DB` (D1), `MEDIA` (R2), `KV` (KV), `TURNSTILE_SECRET` and `ADMIN_*` as secrets (`wrangler secret put`). Never hard-code secrets or commit `.dev.vars`.
- Access the database only through `src/db/*`. Always use `prepare(...).bind(...)`; never build SQL with string concatenation.
- Prices are stored as integer sen (`price_sen`), formatted as `RM 35 / pax` in views only.
- Images: admin uploads go to R2 under `packages/`, `menu/`, `gallery/`. Serve them via `/media/:key` with long cache headers. Every image row stores alt text, and the admin form requires it.
- Public site works without JavaScript. The package selector (event location → cuisine → package → menu choices → event details) is a multi-step server-rendered form using query params; the last step POSTs to `/api/enquiries/booking`. Add small client scripts only for enhancement.
- Branches are venues only (in-house events, `has_hall`). Packages do not belong to a branch; same price at every branch. The booking estimate (`price_sen × pax`) is computed on the server.
- Admin auth: `/admin/*` is protected by Cloudflare Access (preferred). If Access is not used, fall back to session login in `src/lib/auth.ts` (PBKDF2 via Web Crypto, session id in KV, `HttpOnly; Secure; SameSite=Lax` cookie) plus CSRF checks on POSTs.
- After a CMS write, purge cached public pages that show that content.
- Enquiries: validate, verify Turnstile, save to D1, then notify the client (email). A failed notification must not lose the enquiry.

## Domain model (D1)
`branches` (venue: address, phone, maps_link, has_hall, hall_capacity), `cuisines`, `packages` (cuisine_id, service_type `in_house|outside|both`, name, price_sen, min_pax, max_pax, inclusions JSON, is_popular, status), `package_groups` + `package_group_items` ("choose N" dishes from `menu_items`), `menu_items`, `occasions`, `testimonials`, `media`, `enquiries`, `admin_users`, `settings`.
Status values: `published` | `draft` | `hidden`. Public routes show only `published`.
Enquiries: `service_type` NULL = general /contact message; booking fields (event_time, address, menu_choices JSON, estimate_sen); staff fields (delivery_fee_sen, decline_reason, admin_notes). Status `new | quoted | confirmed | declined` (declined needs a reason).

## UI rules
- Follow `docs/design-system.md` exactly: orange `--primary` `#DF5817` / `--primary-strong` `#C94E14` / ink `#111111`, Cormorant Garamond headings, Montserrat body. No script or decorative fonts.
- `--primary` only for large orange (text ≥ 24px, icons, decorative). Any surface with white text under 24px (header, footer, buttons, stepper, active nav) uses `--primary-strong`; hover `--primary-dark`. Destructive actions stay `--error`.
- Readability floor: body ≥ 16px desktop / 15px mobile, captions ≥ 13px, no italic body text.
- Use the CSS variables in `styles/tokens.css`; no raw hex values in components.
- Mobile first; breakpoints 640 / 1024. Tap targets at least 44px. Visible focus ring (2px `--primary-strong`, 2px offset).
- Real `<button>`, `<a>`, `<label>` + `<input>`. Every food image has descriptive alt text.
- Copy is bilingual-ready (EN / BM): keep UI strings in `src/lib/i18n.ts`, not inline.

## Working style
- Keep it simple: use Hono middleware, Web APIs and Cloudflare features before adding a dependency. Ask before adding any new package.
- Small, focused changes. For anything touching more than 3 files, outline the plan first.
- Write tests (Vitest + `@cloudflare/vitest-pool-workers`) for db functions, validation and the enquiry flow.
- When unsure about a Cloudflare API, check the docs (Cloudflare docs MCP or https://developers.cloudflare.com/llms.txt) instead of guessing.
- Never run `--remote` migrations, `wrangler deploy` or delete R2 objects without asking.