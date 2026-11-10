import type { WithImage } from '../../db/shared'
import { IMAGE_WIDTHS, imgUrl } from '../../lib/images'

/** Card photo from R2, or the sand placeholder when the row has no image. Size/shape come from `class`. */
export const Photo = ({ image, class: cls }: { image: WithImage; class: string }) =>
  image.image_key ? (
    <img
      class={cls}
      src={imgUrl(image.image_key, 'card')}
      srcset={`${imgUrl(image.image_key, 'thumb')} ${IMAGE_WIDTHS.thumb}w, ${imgUrl(image.image_key, 'card')} ${IMAGE_WIDTHS.card}w`}
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      alt={image.image_alt ?? ''}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span class={cls} aria-hidden="true" />
  )
