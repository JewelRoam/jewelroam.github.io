import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { photos } from "../lib/content";
import { transformImageUrl } from "../lib/media";
import "./BoardingPage.css";

const BUFFER_ITEMS = 3;
const FLOW_SPEEDS = [12, -8, 15, -9, 13, -7, 10];
const POINTER_FACTORS = [0.4, -0.9, 0.7, -0.5, 1, -0.7, 0.5];

function wrap(value: number, length: number) {
  return ((value % length) + length) % length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function columnCountForWidth(width: number) {
  if (width < 640) return 3;
  if (width < 1100) return 4;
  return 7;
}

function revealLoadedImage(image: HTMLImageElement) {
  const reveal = () => {
    image.closest(".boarding-wall__cell")?.setAttribute("data-loaded", "true");
  };
  image.decode().then(reveal).catch(reveal);
}

type WallMetrics = {
  stride: number;
  renderCount: number;
  speedScale: number;
};

export function BoardingPage() {
  const [columnCount, setColumnCount] = useState(() => columnCountForWidth(window.innerWidth));
  const [metrics, setMetrics] = useState<WallMetrics>({ stride: 1, renderCount: 0, speedScale: 1 });
  const [windowStarts, setWindowStarts] = useState<number[]>(() => (
    Array.from({ length: columnCount }, () => -BUFFER_ITEMS)
  ));
  const wallRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Array<HTMLDivElement | null>>([]);
  const offsetsRef = useRef<number[]>([]);
  const previousStrideRef = useRef(1);
  const windowStartsRef = useRef<number[]>([]);
  const pointerRef = useRef({ x: 0, y: 0 });
  const flowBoostRef = useRef(0);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    moved: boolean;
  } | null>(null);

  const sortedPhotos = useMemo(() => (
    [...photos].sort((a, b) => (a.takenAt + a.id).localeCompare(b.takenAt + b.id))
  ), []);

  const photoColumns = useMemo(() => (
    Array.from({ length: columnCount }, (_, columnIndex) => (
      sortedPhotos.filter((_, photoIndex) => photoIndex % columnCount === columnIndex)
    ))
  ), [columnCount, sortedPhotos]);

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;

    const resize = () => {
      const rect = wall.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const nextColumnCount = columnCountForWidth(rect.width);
      const compact = rect.width <= 640;
      const gap = compact ? 6 : 8;
      const columnWidth = (rect.width - gap * (nextColumnCount - 1)) / nextColumnCount;
      const stride = columnWidth * 0.75 + gap;
      const visibleCount = Math.ceil(rect.height / stride) + 1;
      const renderCount = visibleCount + BUFFER_ITEMS * 2;
      const previousStride = previousStrideRef.current;
      const nextOffsets = Array.from({ length: nextColumnCount }, (_, index) => {
        const seededOffset = index * stride * 4 + (index % 2) * stride * 2;
        const previousOffset = offsetsRef.current[index];
        return previousOffset === undefined ? seededOffset : previousOffset / previousStride * stride;
      });
      const nextStarts = nextOffsets.map((offset) => Math.floor(offset / stride) - BUFFER_ITEMS);

      offsetsRef.current = nextOffsets;
      previousStrideRef.current = stride;
      windowStartsRef.current = nextStarts;
      setColumnCount((current) => current === nextColumnCount ? current : nextColumnCount);
      setMetrics({
        stride,
        renderCount,
        speedScale: compact ? 0.72 : 1,
      });
      setWindowStarts(nextStarts);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wall);
    resize();
    return () => observer.disconnect();
  }, [sortedPhotos]);

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      flowBoostRef.current = clamp(flowBoostRef.current + event.deltaY * unit * 2.2, -1100, 1100);
    };

    wall.addEventListener("wheel", onWheel, { passive: false });
    return () => wall.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!metrics.renderCount || !photoColumns.length || photoColumns.some((column) => !column.length)) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastFrame = 0;

    const paint = () => {
      let startsChanged = false;
      photoColumns.forEach((column, index) => {
        const track = trackRefs.current[index];
        if (!track || !column.length) return;
        const offset = offsetsRef.current[index] ?? 0;
        offsetsRef.current[index] = offset;
        const start = Math.floor(offset / metrics.stride) - BUFFER_ITEMS;
        if (windowStartsRef.current[index] !== start) {
          windowStartsRef.current[index] = start;
          startsChanged = true;
        }
        const pointerFactor = POINTER_FACTORS[index % POINTER_FACTORS.length] ?? 0;
        const x = pointerRef.current.x * pointerFactor;
        const y = -offset + pointerRef.current.y * pointerFactor;
        track.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(2)}px, 0)`;
      });
      if (startsChanged) setWindowStarts([...windowStartsRef.current]);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(50, now - (lastFrame || now - 16)) / 1000;
      lastFrame = now;
      flowBoostRef.current *= Math.exp(-dt / 0.78);
      if (Math.abs(flowBoostRef.current) < 1) flowBoostRef.current = 0;

      if (!dragRef.current) {
        photoColumns.forEach((column, index) => {
          const baseSpeed = (FLOW_SPEEDS[index % FLOW_SPEEDS.length] ?? 10) * metrics.speedScale;
          offsetsRef.current[index] = (offsetsRef.current[index] ?? 0) + (baseSpeed + flowBoostRef.current) * dt;
        });
      }
      paint();
      frame = requestAnimationFrame(tick);
    };

    paint();
    if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [metrics, photoColumns]);

  const applyOffsetDelta = (delta: number) => {
    offsetsRef.current = offsetsRef.current.map((offset) => offset + delta);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    suppressClickRef.current = false;
    flowBoostRef.current = 0;
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = {
      x: (event.clientX / window.innerWidth - 0.5) * 14,
      y: (event.clientY / window.innerHeight - 0.5) * 10,
    };

    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const totalX = event.clientX - drag.startX;
    const totalY = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(totalX, totalY) < 7) return;
      drag.moved = true;
      suppressClickRef.current = true;
      wallRef.current?.setPointerCapture(event.pointerId);
      wallRef.current?.setAttribute("data-dragging", "true");
    }

    event.preventDefault();
    const deltaY = event.clientY - drag.lastY;
    const elapsed = Math.max(8, event.timeStamp - drag.lastTime) / 1000;
    const velocity = -deltaY / elapsed;
    flowBoostRef.current = clamp(flowBoostRef.current * 0.35 + velocity * 0.65, -1400, 1400);
    applyOffsetDelta(-deltaY);
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (event.type === "pointercancel") flowBoostRef.current = 0;
    dragRef.current = null;
    wallRef.current?.removeAttribute("data-dragging");
    if (wallRef.current?.hasPointerCapture(event.pointerId)) {
      wallRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const totalCount = photos.length;
  const placeCount = new Set(photos.map((photo) => photo.placeId)).size;
  const imageWidth = columnCount <= 2 ? 360 : 240;

  return (
    <div className="boarding">
      <section className="boarding-stage" aria-label="照片灯箱">
        <div
          ref={wallRef}
          className="boarding-wall"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
          onPointerLeave={(event) => {
            if (!dragRef.current) pointerRef.current = { x: 0, y: 0 };
            endPointer(event);
          }}
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={(event) => {
            if (!suppressClickRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }}
        >
          {photoColumns.map((column, columnIndex) => {
            const start = windowStarts[columnIndex] ?? -BUFFER_ITEMS;
            return (
              <div key={columnIndex} className="boarding-wall__column">
                <div
                  ref={(element) => {
                    trackRefs.current[columnIndex] = element;
                  }}
                  className="boarding-wall__track"
                >
                  {Array.from({ length: metrics.renderCount }, (_, itemIndex) => {
                    const globalIndex = start + itemIndex;
                    const photo = column[wrap(globalIndex, column.length)];
                    if (!photo) return null;
                    return (
                      <Link
                        key={photo.id}
                        to={`/photos/${photo.id}`}
                        className="boarding-wall__cell"
                        style={{ top: `${globalIndex * metrics.stride}px` }}
                        tabIndex={-1}
                      >
                        <img
                          ref={(image) => {
                            if (image?.complete && image.naturalWidth > 0) revealLoadedImage(image);
                          }}
                          src={transformImageUrl(photo.media.path, imageWidth)}
                          alt=""
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          onLoad={(event) => revealLoadedImage(event.currentTarget)}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="boarding-hero">
          <p className="boarding-hero__meta">{totalCount} 张照片 · {placeCount} 个地点</p>
          <h1 className="boarding-hero__title font-serif">JewelRoam</h1>
        </div>
      </section>
    </div>
  );
}
