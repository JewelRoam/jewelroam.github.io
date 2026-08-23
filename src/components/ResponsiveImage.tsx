import type { ImgHTMLAttributes } from "react";
import type { Photo } from "../lib/content";
import { imageFallbackUrl, imageSrcSet, type ImageWidth, transformImageUrl } from "../lib/media";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt" | "width" | "height"> & {
  photo: Photo;
  priority?: boolean;
};

type RenderProps = ImageProps & {
  src: string;
  srcSet?: string;
  sizes?: string;
};

function PhotoImage({ photo, src, srcSet, sizes, priority = false, ...props }: RenderProps) {
  const fallbackUrl = imageFallbackUrl(photo.media.fallbackPath || photo.media.path);

  return (
    <img
      {...props}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={photo.dimensions.width}
      height={photo.dimensions.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.removeAttribute("srcset");
        event.currentTarget.removeAttribute("sizes");
        event.currentTarget.src = fallbackUrl;
      }}
    />
  );
}

type ResponsiveImageProps = ImageProps & {
  width?: ImageWidth;
  sizes?: string;
};

export function ResponsiveImage({ photo, width = 1280, sizes = "100vw", ...props }: ResponsiveImageProps) {
  return (
    <PhotoImage
      {...props}
      photo={photo}
      src={transformImageUrl(photo.media.path, width)}
      srcSet={imageSrcSet(photo.media.path)}
      sizes={sizes}
    />
  );
}

export function OriginalImage({ photo, ...props }: ImageProps) {
  return (
    <PhotoImage
      {...props}
      photo={photo}
      src={imageFallbackUrl(photo.media.path)}
    />
  );
}
