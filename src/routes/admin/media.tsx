import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import { createMedia, listMedia, type Media, type MediaFolder } from '../../db/media'
import type { AdminEnv } from '../../lib/auth'
import { adminT } from '../../lib/i18n'
import { IMAGE_TYPES, mediaUploadSchema } from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { fieldAria, FormField } from '../../views/components/FormField'

const t = adminT.media
const FOLDERS = Object.keys(t.folders) as MediaFolder[]
type UploadField = keyof typeof t.errors

type Props = { items: Media[]; uploaded?: boolean; values?: { folder?: string; alt?: string }; errors?: UploadField[] }

const MediaPage = ({ items, uploaded, values = {}, errors = [] }: Props) => {
  const err = (k: UploadField) => (errors.includes(k) ? t.errors[k] : undefined)
  return (
    <>
      <title>{`${adminT.sections.media} | ${adminT.title}`}</title>
      <div class="admin-head">
        <h1>{adminT.sections.media}</h1>
      </div>
      {uploaded && (
        <p class="notice notice--success" role="status">
          {t.uploaded}
        </p>
      )}
      <form method="post" enctype="multipart/form-data" class="panel form" novalidate>
        <h2>{t.upload}</h2>
        {errors.length > 0 && (
          <p class="notice notice--error" role="alert">
            {adminT.formError}
          </p>
        )}
        <div class="form__grid">
          <FormField id="file" label={t.file} error={err('file')}>
            <input id="file" name="file" type="file" class="input" required accept={Object.keys(IMAGE_TYPES).join(',')} {...fieldAria('file', err('file'))} />
          </FormField>
          <FormField id="folder" label={t.folder} error={err('folder')}>
            <select id="folder" name="folder" class="input" {...fieldAria('folder', err('folder'))}>
              {FOLDERS.map((f) => (
                <option value={f} selected={values.folder === f}>
                  {t.folders[f]}
                </option>
              ))}
            </select>
          </FormField>
          <div class="form__wide">
            <FormField id="alt" label={t.alt} error={err('alt')}>
              <input id="alt" name="alt" type="text" class="input" required minlength={3} maxlength={300} value={values.alt ?? ''} {...fieldAria('alt', err('alt'))} />
            </FormField>
          </div>
        </div>
        <Button type="submit">{t.submit}</Button>
      </form>
      <section class="panel">
        <h2>{t.library}</h2>
        {items.length === 0 ? (
          <p>{adminT.none}</p>
        ) : (
          <ul class="media-grid">
            {items.map((m) => (
              <li>
                <figure>
                  <img src={`/media/${m.r2_key}`} alt={m.alt} loading="lazy" />
                  <figcaption>
                    {m.alt}
                    <div class="caption">{t.folders[m.folder]}</div>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

const media = new Hono<AdminEnv>()

media.get('/', async (c) => c.render(<MediaPage items={await listMedia(c.env.DB)} uploaded={c.req.query('uploaded') === '1'} />))

media.post(
  '/',
  zValidator('form', mediaUploadSchema, async (result, c) => {
    if (result.success) return
    const ctx = c as unknown as Context<AdminEnv>
    const raw = result.data as Record<string, unknown>
    const errors = [...new Set(result.error.issues.map((i) => String(i.path[0])))] as UploadField[]
    ctx.status(400)
    return ctx.render(
      <MediaPage
        items={await listMedia(ctx.env.DB)}
        values={{ folder: String(raw.folder ?? ''), alt: String(raw.alt ?? '') }}
        errors={errors}
      />,
    )
  }),
  async (c) => {
    const { folder, alt, file } = c.req.valid('form')
    // A new random key per upload, so /media can cache it forever.
    const key = `${folder}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES]}`
    await c.env.MEDIA.put(key, file, { httpMetadata: { contentType: file.type } })
    try {
      await createMedia(c.env.DB, { r2_key: key, folder, alt, content_type: file.type, size_bytes: file.size, width: null, height: null })
    } catch (e) {
      // Do not leave an object no row points to.
      await c.env.MEDIA.delete(key)
      throw e
    }
    return c.redirect('/admin/media?uploaded=1', 303)
  },
)

export default media
