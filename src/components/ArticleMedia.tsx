import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getPhoto, type Photo } from "../lib/content";
import { ImageFrame } from "./ImageFrame";
import { ResponsiveImage } from "./ResponsiveImage";

type ArticleMediaProps = {
  children: ReactNode;
  layout?: "single" | "sequence" | "gallery";
};

export function ArticleMedia({ children, layout = "single" }: ArticleMediaProps) {
  return <div className={`article-media article-media--${layout}`}>{children}</div>;
}

export function ArticleImage({
  photo,
  caption,
  fill = false,
  sizes = "(min-width: 768px) 48rem, 100vw",
}: {
  photo: Photo;
  caption?: string;
  fill?: boolean;
  sizes?: string;
}) {
  return (
    <ImageFrame
      className="article-media__item"
      caption={caption}
    >
      <ResponsiveImage
        photo={photo}
        sizes={sizes}
        className={`media-frame__image article-image${fill ? " article-image--fill" : " media-frame__image--bounded"}`}
      />
    </ImageFrame>
  );
}

export function PhotoGallery({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => ({ id, photo: getPhoto(id) }));
  if (!entries.length) return null;

  return (
    <ArticleMedia layout="gallery">
      {entries.map(({ id, photo }) => photo ? (
        <Link
          key={photo.id}
          to={`/photos/${photo.id}`}
          className="article-media__link"
          aria-label={`查看${photo.title}详情`}
        >
          <ArticleImage photo={photo} />
        </Link>
      ) : (
        <p key={id} className="article-media__missing" role="alert">图片引用缺失：{id}</p>
      ))}
    </ArticleMedia>
  );
}
