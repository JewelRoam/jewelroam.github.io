import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { photos } from "../lib/content";
import { transformImageUrl } from "../lib/media";
import "./BoardingPage.css";

const WALL_COUNT = 360;

const DRIFT_FACTORS = [0, -0.07, 0.045, -0.1, 0.06, -0.035, 0.085];
const POINTER_FACTORS = [0.4, -0.9, 0.7, -0.5, 1, -0.7, 0.5];

function columnCountForWidth(width: number) {
  if (width < 640) return 2;
  if (width < 1100) return 4;
  return 7;
}

export function BoardingPage() {
  const [columnCount, setColumnCount] = useState(() => columnCountForWidth(window.innerWidth));
  const wallRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerFrameRef = useRef(0);

  const wallPhotos = useMemo(() => {
    const sorted = [...photos].sort((a, b) => (a.takenAt + a.id).localeCompare(b.takenAt + b.id));
    const stride = Math.max(1, Math.floor(sorted.length / WALL_COUNT));
    const sampled = sorted.filter((_, index) => index % stride === 0).slice(0, WALL_COUNT);
    const columns: typeof sampled[] = Array.from({ length: 7 }, () => []);
    sampled.forEach((photo, index) => columns[index % 7].push(photo));
    return columns;
  }, []);

  useEffect(() => {
    const onResize = () => setColumnCount(columnCountForWidth(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    let frame = 0;
    const applyPointer = () => {
      pointerFrameRef.current = 0;
      const { x, y } = pointerRef.current;
      columnRefs.current.forEach((column, index) => {
        if (!column) return;
        const factor = POINTER_FACTORS[index % POINTER_FACTORS.length] ?? 0;
        column.style.setProperty("--px", `${(x * factor).toFixed(1)}px`);
        column.style.setProperty("--py", `${(y * factor).toFixed(1)}px`);
      });
    };
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 14,
        y: (event.clientY / window.innerHeight - 0.5) * 10,
      };
      if (!pointerFrameRef.current) pointerFrameRef.current = requestAnimationFrame(applyPointer);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        columnRefs.current.forEach((column, index) => {
          if (!column) return;
          const drift = y * (DRIFT_FACTORS[index % DRIFT_FACTORS.length] ?? 0);
          column.style.setProperty("--drift", `${drift.toFixed(1)}px`);
        });
        wallRef.current?.style.setProperty("--boarding-fade", Math.min(1, y / window.innerHeight).toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      if (frame) cancelAnimationFrame(frame);
      if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
    };
  }, []);

  const totalCount = photos.length;
  const placeCount = new Set(photos.map((photo) => photo.placeId)).size;

  return (
    <div className="boarding">
      <section className="boarding-stage" aria-label="照片灯箱">
        <div ref={wallRef} className="boarding-wall" aria-hidden="true">
          {wallPhotos.slice(0, columnCount).map((column, columnIndex) => (
            <div
              key={columnIndex}
              ref={(el) => {
                columnRefs.current[columnIndex] = el;
              }}
              className="boarding-wall__column"
            >
              {column.map((photo) => (
                <Link
                  key={photo.id}
                  to={`/photos/${photo.id}`}
                  className="boarding-wall__cell"
                  tabIndex={-1}
                >
                  <img
                    src={transformImageUrl(photo.media.path, 240)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="boarding-hero">
          <p className="boarding-hero__meta">{totalCount} 张照片 · {placeCount} 个地点</p>
          <h1 className="boarding-hero__title font-serif">JewelRoam</h1>
        </div>
      </section>

      <section className="boarding-index" aria-label="站内索引">
        <nav className="boarding-index__list">
          <Link to="/destinations" className="boarding-index__item">
            <span className="boarding-index__name font-serif">Destinations</span>
          </Link>
          <Link to="/journals" className="boarding-index__item">
            <span className="boarding-index__name font-serif">Journals</span>
          </Link>
          <Link to="/capture" className="boarding-index__item">
            <span className="boarding-index__name font-serif">Capture</span>
          </Link>
          <Link to="/jewelroam" className="boarding-index__item">
            <span className="boarding-index__name font-serif">JewelRoam</span>
          </Link>
        </nav>
      </section>
    </div>
  );
}
