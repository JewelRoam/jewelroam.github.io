import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getPhoto, type Photo } from "../lib/content";
import { ResponsiveImage } from "./ResponsiveImage";

type ArticleMediaProps = {
  children: ReactNode;
  layout?: "single" | "stack" | "gallery";
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

export function PhotoGallery({ ids }: { ids: string[] }) {
  const photos = ids.map((id) => getPhoto(id)).filter((photo): photo is Photo => Boolean(photo));
  if (!photos.length) return null;

  return (
    <ArticleMedia layout="gallery">
      {photos.map((photo) => (
        <Link
          key={photo.id}
          to={`/photos/${photo.id}`}
          className="article-media__link"
          aria-label={`查看${photo.title}详情`}
        >
          <ArticleImage photo={photo} />
        </Link>
      ))}
    </ArticleMedia>
  );
}
