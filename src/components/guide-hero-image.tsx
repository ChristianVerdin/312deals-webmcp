import type { GuidePhoto } from "@/lib/guide-photos"

/**
 * Full-width hero image for guide pages. Renders an Unsplash HOTLINK (per their
 * API guidelines, never self-hosted) with the required photographer + Unsplash
 * attribution overlaid. Mobile-first 16:9, widening to 2:1 on larger screens.
 */
export function GuideHeroImage({
  photo,
  priority = false,
}: {
  photo?: GuidePhoto
  priority?: boolean
}) {
  if (!photo?.url) return null
  return (
    <figure className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border sm:aspect-[2/1]">
      {/* Plain <img> = true hotlink straight to the Unsplash CDN (per Unsplash
          API guidelines, not proxied/cached via next/image). URL already sized
          via &w=1600&q=80. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <figcaption className="absolute bottom-0 right-0 m-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-none text-white/85 backdrop-blur-sm">
        Photo:{" "}
        <a href={photo.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
          {photo.photographer}
        </a>
        {" / "}
        <a
          href="https://unsplash.com/?utm_source=312deals&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
        >
          Unsplash
        </a>
      </figcaption>
    </figure>
  )
}
