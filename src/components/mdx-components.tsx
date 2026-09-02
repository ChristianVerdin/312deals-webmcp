import Image from "next/image"
import Link from "next/link"
import type { MDXComponents } from "mdx/types"

export const mdxComponents: MDXComponents = {
  a: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  },

  img: ({
    src,
    alt,
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <figure className="my-6">
      <Image
        src={src ?? ""}
        alt={alt ?? ""}
        width={800}
        height={450}
        className="rounded-xl"
      />
      {alt && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {alt}
        </figcaption>
      )}
    </figure>
  ),

  Callout: ({
    children,
    type = "info",
  }: {
    children: React.ReactNode
    type?: "info" | "tip" | "warning"
  }) => {
    const styles = {
      info: "border-brand-500/30 bg-brand-50 dark:bg-brand-950/20",
      tip: "border-green-500/30 bg-green-50 dark:bg-green-950/20",
      warning: "border-chi-red-500/30 bg-red-50 dark:bg-red-950/20",
    }
    return (
      <div className={`my-6 rounded-xl border-l-4 p-4 ${styles[type]}`}>
        {children}
      </div>
    )
  },

  DealLink: ({ venue, slug }: { venue: string; slug: string }) => (
    <Link
      href={`/venues/${slug}`}
      className="inline-flex items-center gap-1 font-medium text-brand-500 hover:underline"
    >
      {venue} <span className="text-xs">&rarr; see deals</span>
    </Link>
  ),

  NeighborhoodLink: ({ name, slug }: { name: string; slug: string }) => (
    <Link
      href={`/neighborhoods/${slug}`}
      className="font-medium text-brand-500 hover:underline"
    >
      {name}
    </Link>
  ),
}
