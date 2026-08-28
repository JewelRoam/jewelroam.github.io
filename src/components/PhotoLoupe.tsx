import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { Photo } from "../lib/content";
import { imageFallbackUrl, transformImageUrl } from "../lib/media";
import { OriginalImage } from "./ResponsiveImage";
import "./PhotoLoupe.css";

type Point = {
  x: number;
  y: number;
};

type PhotoLoupeProps = {
  photo: Photo;
  className?: string;
  priority?: boolean;
  zoom?: number;
};

const DEFAULT_ZOOM = 2.4;
const KEYBOARD_STEP = 0.06;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * An on-demand detail view for a single photograph. The base image stays
 * responsible for loading and fallback behavior; the loupe only mounts after
 * the reader explicitly enables it.
 */
export function PhotoLoupe({ photo, className, priority = false, zoom = DEFAULT_ZOOM }: PhotoLoupeProps) {
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const zoomedImageRef = useRef<HTMLImageElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointRef = useRef<Point>({ x: 0.5, y: 0.5 });
  const draggingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const instructionsId = useId();
  const viewportId = useId();
  // The lens only needs a detail-sized bitmap. Avoid fetching a potentially
  // very large original just because the reader opened the loupe.
  const loupeSource = transformImageUrl(photo.media.path, 2048);
  const fallbackSource = photo.media.fallbackPath
    ? transformImageUrl(photo.media.fallbackPath, 2048)
    : imageFallbackUrl(photo.media.path);

  const getContentRect = useCallback((baseImage: HTMLImageElement) => {
    const box = baseImage.getBoundingClientRect();
    const sourceWidth = baseImage.naturalWidth || photo.dimensions.width;
    const sourceHeight = baseImage.naturalHeight || photo.dimensions.height;
    const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return {
      left: box.left + (box.width - width) / 2,
      top: box.top + (box.height - height) / 2,
      width,
      height,
    };
  }, [photo.dimensions.height, photo.dimensions.width]);

  const applyPoint = useCallback((point: Point) => {
    const viewport = viewportRef.current;
    const lens = lensRef.current;
    const zoomedImage = zoomedImageRef.current;
    const baseImage = viewport?.querySelector<HTMLImageElement>(".photo-loupe__base-image");
    if (!viewport || !lens || !zoomedImage || !baseImage) return;

    const viewportRect = viewport.getBoundingClientRect();
    const imageRect = getContentRect(baseImage);
    const lensRect = lens.getBoundingClientRect();
    if (!viewportRect.width || !viewportRect.height || !imageRect.width || !imageRect.height) return;

    const imageLeft = imageRect.left - viewportRect.left;
    const imageTop = imageRect.top - viewportRect.top;
    const pointerX = clamp(point.x) * imageRect.width;
    const pointerY = clamp(point.y) * imageRect.height;
    const rawLensX = imageLeft + pointerX;
    const rawLensY = imageTop + pointerY;
    const lensX = clamp(rawLensX, lensRect.width / 2, viewportRect.width - lensRect.width / 2);
    const lensY = clamp(rawLensY, lensRect.height / 2, viewportRect.height - lensRect.height / 2);
    // Keep the magnified bitmap under the whole lens, even when the pointer is
    // at an edge where the source image itself has no pixels beyond the frame.
    const sourceInsetX = Math.min(imageRect.width / 2, lensRect.width / (2 * zoom));
    const sourceInsetY = Math.min(imageRect.height / 2, lensRect.height / (2 * zoom));
    const sourceMinX = sourceInsetX / imageRect.width;
    const sourceMaxX = 1 - sourceMinX;
    const sourceMinY = sourceInsetY / imageRect.height;
    const sourceMaxY = 1 - sourceMinY;
    const sourceX = (sourceMaxX >= sourceMinX ? clamp(point.x, sourceMinX, sourceMaxX) : 0.5) * imageRect.width;
    const sourceY = (sourceMaxY >= sourceMinY ? clamp(point.y, sourceMinY, sourceMaxY) : 0.5) * imageRect.height;
    const scaledWidth = imageRect.width * zoom;
    const scaledHeight = imageRect.height * zoom;

    lens.style.left = `${lensX}px`;
    lens.style.top = `${lensY}px`;
    zoomedImage.style.width = `${scaledWidth}px`;
    zoomedImage.style.height = `${scaledHeight}px`;
    zoomedImage.style.left = `${lensRect.width / 2 - sourceX * zoom}px`;
    zoomedImage.style.top = `${lensRect.height / 2 - sourceY * zoom}px`;
  }, [getContentRect, zoom]);

  const schedulePoint = useCallback((point: Point) => {
    pointRef.current = point;
    if (typeof window === "undefined" || frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      applyPoint(pointRef.current);
    });
  }, [applyPoint]);

  const pointFromClient = useCallback((clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    const baseImage = viewport?.querySelector<HTMLImageElement>(".photo-loupe__base-image");
    if (!baseImage) return;

    const imageRect = getContentRect(baseImage);
    if (!imageRect.width || !imageRect.height) return;
    schedulePoint({
      x: clamp((clientX - imageRect.left) / imageRect.width),
      y: clamp((clientY - imageRect.top) / imageRect.height),
    });
  }, [schedulePoint]);

  useEffect(() => {
    if (!active) {
      draggingRef.current = false;
      setDragging(false);
      return undefined;
    }

    schedulePoint(pointRef.current);
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleResize = () => schedulePoint(pointRef.current);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(handleResize);
      observer.observe(viewport);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [active, schedulePoint]);

  useEffect(() => () => {
    if (frameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const toggleLoupe = (event: MouseEvent<HTMLButtonElement>) => {
    const nextActive = !active;
    setActive(nextActive);
    // Keep keyboard activation in the loupe viewport so arrow keys work
    // immediately, while pointer activation leaves the trigger in place.
    if (nextActive && event.detail === 0) {
      window.requestAnimationFrame(() => viewportRef.current?.focus());
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointFromClient(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!active || (event.pointerType !== "mouse" && !draggingRef.current)) return;
    pointFromClient(event.clientX, event.clientY);
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setActive(false);
      triggerRef.current?.focus();
      return;
    }

    const nextPoint = { ...pointRef.current };
    const step = event.shiftKey ? KEYBOARD_STEP * 2 : KEYBOARD_STEP;
    if (event.key === "ArrowLeft") nextPoint.x -= step;
    else if (event.key === "ArrowRight") nextPoint.x += step;
    else if (event.key === "ArrowUp") nextPoint.y -= step;
    else if (event.key === "ArrowDown") nextPoint.y += step;
    else return;

    event.preventDefault();
    schedulePoint({ x: clamp(nextPoint.x), y: clamp(nextPoint.y) });
  };

  const imageClassName = ["photo-loupe__base-image", className].filter(Boolean).join(" ");
  const triggerLabel = active ? "关闭照片放大镜" : "打开照片放大镜";

  return (
    <div
      className={`photo-loupe${active ? " is-active" : ""}${dragging ? " is-dragging" : ""}`}
      data-active={active || undefined}
    >
      <div
        ref={viewportRef}
        id={viewportId}
        className="photo-loupe__viewport"
        tabIndex={active ? 0 : -1}
        aria-label="照片放大查看区域"
        aria-describedby={instructionsId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onKeyDown={handleKeyDown}
      >
        <OriginalImage
          photo={photo}
          priority={priority}
          className={imageClassName}
          draggable={false}
          onLoad={() => active && schedulePoint(pointRef.current)}
        />
        {active && (
          <div ref={lensRef} className="photo-loupe__lens" aria-hidden="true">
            <img
              ref={zoomedImageRef}
              className="photo-loupe__zoomed-image"
              src={loupeSource}
              alt=""
              draggable={false}
              decoding="async"
              onError={(event) => {
                const image = event.currentTarget;
                if (fallbackSource && image.dataset.fallbackAttempted !== "true") {
                  image.dataset.fallbackAttempted = "true";
                  image.src = fallbackSource;
                } else {
                  image.hidden = true;
                }
              }}
            />
          </div>
        )}
        <button
          ref={triggerRef}
          type="button"
          className="photo-loupe__trigger"
          aria-label={triggerLabel}
          aria-controls={viewportId}
          aria-pressed={active}
          title={triggerLabel}
          onClick={toggleLoupe}
        >
          {active ? <ZoomOut size={18} strokeWidth={1.8} aria-hidden="true" /> : <ZoomIn size={18} strokeWidth={1.8} aria-hidden="true" />}
        </button>
      </div>
      <span id={instructionsId} className="photo-loupe__sr-only">
        开启放大镜后可使用方向键移动查看区域；触摸设备可拖动照片。
      </span>
    </div>
  );
}
