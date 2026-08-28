import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
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

/**
 * Keep image state local to one source identity. A keyed instance also clears
 * a previous fallback attempt when a list reuses the component for another
 * photo, without briefly showing the old error state.
 */
function PhotoImage({ photo, src, srcSet, sizes, ...props }: RenderProps) {
  const fallbackUrl = imageFallbackUrl(photo.media.fallbackPath || photo.media.path);
  const imageKey = [
    photo.id,
    src,
    srcSet ?? "",
    fallbackUrl,
    photo.dimensions.width,
    photo.dimensions.height,
  ].join("\u0000");

  return (
    <PhotoImageInstance
      key={imageKey}
      photo={photo}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      {...props}
    />
  );
}

function PhotoImageInstance({ photo, src, srcSet, sizes, priority = false, ...props }: RenderProps) {
  const fallbackUrl = imageFallbackUrl(photo.media.fallbackPath || photo.media.path);
  const imageRef = useRef<HTMLImageElement>(null);
  const fallbackAttemptedRef = useRef(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const { onError, onLoad, ...imageProps } = props;

  // Cached images may not emit a load event after React attaches its
  // handlers. Inspect the committed element so they leave the placeholder.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setState("ready");
    }
  }, [fallbackActive]);

  const handleLoad: NonNullable<ImgHTMLAttributes<HTMLImageElement>["onLoad"]> = (event) => {
    setState("ready");
    onLoad?.(event);
  };

  const handleError: NonNullable<ImgHTMLAttributes<HTMLImageElement>["onError"]> = (event) => {
    const image = event.currentTarget;
    const currentSource = image.currentSrc || image.src;
    if (!fallbackAttemptedRef.current && !fallbackActive && fallbackUrl !== currentSource) {
      fallbackAttemptedRef.current = true;
      setFallbackActive(true);
      return;
    }
    setState("error");
    onError?.(event);
  };

  return (
    <span
      className="photo-image-shell"
      data-image-state={state}
      style={{
        // Reserve the source ratio only while the image has no usable layout.
        // Once ready, let bounded images keep their caller-defined height.
        aspectRatio: state === "ready"
          ? "auto"
          : `${photo.dimensions.width} / ${photo.dimensions.height}`,
        display: "block",
      }}
    >
      <img
        {...imageProps}
        ref={imageRef}
        src={fallbackActive ? fallbackUrl : src}
        srcSet={fallbackActive ? undefined : srcSet}
        sizes={fallbackActive ? undefined : sizes}
        width={photo.dimensions.width}
        height={photo.dimensions.height}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={handleLoad}
        onError={handleError}
      />
      {state === "error" && (
        <span className="photo-image-error" role="alert">
          <span>图片暂时无法加载</span>
          <a href={fallbackUrl} target="_blank" rel="noreferrer">打开原图</a>
        </span>
      )}
    </span>
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
