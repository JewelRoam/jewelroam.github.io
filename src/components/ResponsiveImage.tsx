import type { ImgHTMLAttributes } from "react";
import type { Photo } from "../lib/content";
import { imageFallbackUrl, imageSrcSet, transformImageUrl } from "../lib/media";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt" | "width" | "height"> & {
  photo: Photo;
  width?: 640 | 1280 | 2048;
  priority?: boolean;
};

export function ResponsiveImage({ photo, width = 1280, priority = false, sizes = "100vw", ...props }: Props) {
  return (
    <img
      {...props}
      src={transformImageUrl(photo.media.path, width)}
      srcSet={imageSrcSet(photo.media.path)}
      sizes={sizes}
      width={photo.dimensions.width}
      height={photo.dimensions.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = imageFallbackUrl(photo.media.fallbackPath);
      }}
    />
  );
}
