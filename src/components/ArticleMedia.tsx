import type { ReactNode } from "react";
import type { Photo } from "../lib/content";
import { ResponsiveImage } from "./ResponsiveImage";

type ArticleMediaProps = {
  children: ReactNode;
  layout?: "single" | "stack";
};

export function ArticleMedia({ children, layout = "single" }: ArticleMediaProps) {
  return <div className={`article-media article-media--${layout}`}>{children}</div>;
}

export function ArticleImage({ photo, caption }: { photo: Photo; caption?: string }) {
  return (
    <figure className="article-media__item">
      <ResponsiveImage
        photo={photo}
        sizes="(min-width: 768px) 48rem, 100vw"
        className="article-image"
      />
      {caption && <figcaption className="mt-3 text-sm text-[#20211f]/55">{caption}</figcaption>}
    </figure>
  );
}
