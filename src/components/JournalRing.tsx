import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { journals, photos } from "../lib/content";
import { transformImageUrl } from "../lib/media";
import "./JournalRing.css";

function wrap(value: number, count: number) {
  return ((value % count) + count) % count;
}

function seededOffset(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value) - 0.5;
}

const AUTO_RESUME_DELAY_MS = 1200;
const AUTO_FLOW_SPEED = 0.00014;

export function JournalRing() {
  const entries = useMemo(() => journals.map(({ frontmatter }) => ({
    ...frontmatter,
    cover: photos
      .filter((photo) => photo.id.startsWith(frontmatter.slug + "-"))
      .sort((a, b) => a.id.localeCompare(b.id))[0],
  })), []);
  const count = entries.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const moveRef = useRef<(index: number) => void>(() => {});
  const positionRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !count) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rootStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousRootOverscroll = rootStyle.getPropertyValue("overscroll-behavior-x");
    const previousBodyOverscroll = bodyStyle.getPropertyValue("overscroll-behavior-x");
    rootStyle.setProperty("overscroll-behavior-x", "none");
    bodyStyle.setProperty("overscroll-behavior-x", "none");
    let reduced = reducedMotion.matches;
    let frame = 0;
    let lastFrame = 0;
    let snapTimer = 0;
    let position = positionRef.current;
    let target = position;
    let velocity = 0;
    let coasting = false;
    let inView = true;
    let width = 1;
    let height = 1;
    let cardWidth = 1;
    let radiusX = 1;
    let radiusZ = 1;
    let compact = false;
    let active = wrap(Math.round(position), count);
    let lastInteraction = performance.now();
    let drag: {
      id: number; x: number; y: number; lastX: number; lastTime: number;
      origin: number; axis: "x" | "y" | null;
    } | null = null;
    let touchGesture: { id: number; x: number; y: number; axis: "x" | "y" | null } | null = null;
    const step = (Math.PI * 2) / Math.max(count, 3);

    const paint = () => {
      positionRef.current = position;
      const nextActive = wrap(Math.round(position), count);
      if (nextActive !== active) {
        active = nextActive;
        setActiveIndex(active);
      }
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const distance = wrap(index - position + count / 2, count) - count / 2;
        const angle = distance * step;
        let x: number;
        let y: number;
        let z: number;
        let rotation: number;
        let scale: number;
        let opacity: number;
        let visible: boolean;
        if (compact) {
          const magnitude = Math.min(3, Math.abs(distance));
          x = distance * cardWidth * 0.72;
          y = magnitude * 10;
          z = -magnitude * 92;
          rotation = -distance * 0.13;
          scale = 1 - magnitude * 0.055;
          opacity = Math.max(0, 1 - magnitude * 0.32);
          visible = Math.abs(distance) < 1.65;
        } else {
          const depth = Math.cos(angle);
          const normalizedDepth = (depth + 1) / 2;
          x = Math.sin(angle) * radiusX;
          y = seededOffset(index, 1) * height * 0.3 - (1 - normalizedDepth) * height * 0.035;
          z = (depth - 1) * radiusZ;
          rotation = angle;
          scale = 0.78 + normalizedDepth * 0.28;
          opacity = 0.18 + Math.pow(normalizedDepth, 1.7) * 0.82;
          visible = opacity > 0.08;
        }
        card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${rotation.toFixed(5)}rad) scale(${scale.toFixed(4)})`;
        card.style.opacity = visible ? opacity.toFixed(3) : "0";
        card.style.visibility = visible ? "visible" : "hidden";
        card.style.pointerEvents = visible ? "auto" : "none";
        card.style.zIndex = String(Math.round(opacity * 100));
      });
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(32, now - (lastFrame || now - 16));
      lastFrame = now;
      if (!reduced && !drag && !coasting && position === target && now - lastInteraction > AUTO_RESUME_DELAY_MS) {
        position += dt * AUTO_FLOW_SPEED;
        target = position;
      }
      if (coasting) {
        position += velocity * dt;
        velocity *= Math.exp(-dt / 210);
        if (Math.abs(velocity) < 0.00035) {
          coasting = false;
          target = Math.round(position);
        }
      } else {
        position += (target - position) * (reduced ? 1 : 1 - Math.exp(-dt / 85));
        if (Math.abs(target - position) < 0.0005) position = target;
      }
      paint();
      if (inView && (!reduced || coasting || position !== target)) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame && inView) {
        lastFrame = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const settle = () => {
      coasting = false;
      velocity = 0;
      target = Math.round(target);
      wake();
    };
    moveRef.current = (index) => {
      window.clearTimeout(snapTimer);
      coasting = false;
      velocity = 0;
      target = index;
      lastInteraction = performance.now();
      if (reduced) position = target;
      wake();
    };

    const resize = () => {
      width = viewport.clientWidth;
      height = viewport.clientHeight;
      compact = width <= 640;
      cardWidth = compact ? Math.min(width * 0.68, 320) : Math.min(Math.max(width * 0.14, 150), 220);
      radiusX = Math.min(Math.max(width * 0.38, 360), 620);
      radiusZ = radiusX * 0.72;
      viewport.style.setProperty("--ring-card-width", cardWidth + "px");
      viewport.style.perspective = Math.max(900, width * 0.95) + "px";
      paint();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      window.clearTimeout(snapTimer);
      suppressClickRef.current = false;
      coasting = false;
      velocity = 0;
      target = position;
      lastInteraction = performance.now();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
        lastX: event.clientX, lastTime: event.timeStamp, origin: position, axis: null };
    };
    const onPointerTilt = (event: PointerEvent) => {
      if (compact || drag || reduced) return;
      const rect = viewport.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      viewport.style.setProperty("--ring-tilt-x", `${(-y * 3).toFixed(3)}deg`);
      viewport.style.setProperty("--ring-tilt-y", `${(x * 4).toFixed(3)}deg`);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < 7) return;
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        if (drag.axis === "x") {
          viewport.setPointerCapture(event.pointerId);
          viewport.dataset.dragging = "true";
          suppressClickRef.current = true;
        }
      }
      if (drag.axis !== "x") return;
      event.preventDefault();
      const stride = compact ? cardWidth * 0.78 : cardWidth * 1.25;
      const elapsed = Math.max(8, event.timeStamp - drag.lastTime);
      const sample = -(event.clientX - drag.lastX) / stride / elapsed;
      velocity = velocity * 0.35 + sample * 0.65;
      drag.lastX = event.clientX;
      drag.lastTime = event.timeStamp;
      lastInteraction = performance.now();
      target = drag.origin - dx / stride;
      position = target;
      paint();
    };
    const release = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.axis === "x";
      const cancelled = event.type !== "pointerup";
      if (event.timeStamp - drag.lastTime > 100 || cancelled) velocity = 0;
      drag = null;
      delete viewport.dataset.dragging;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      lastInteraction = performance.now();
      if (!moved) return;
      if (!reduced && !cancelled && Math.abs(velocity) > 0.0006) {
        velocity = Math.max(-0.012, Math.min(0.012, velocity));
        coasting = true;
        wake();
      } else settle();
    };
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      touchGesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, axis: null };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!touchGesture) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchGesture?.id);
      if (!touch) return;
      const dx = touch.clientX - touchGesture.x;
      const dy = touch.clientY - touchGesture.y;
      if (!touchGesture.axis && Math.hypot(dx, dy) > 8) {
        touchGesture.axis = Math.abs(dx) > Math.abs(dy) * 0.65 ? "x" : "y";
      }
      if (touchGesture.axis === "x") event.preventDefault();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!touchGesture) return;
      if (Array.from(event.changedTouches).some((touch) => touch.identifier === touchGesture?.id)) touchGesture = null;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || count < 2) return;
      const horizontalIntent = Math.abs(event.deltaX) > 5 && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.25;
      if (!event.shiftKey && !horizontalIntent) return;
      event.preventDefault();
      coasting = false;
      velocity = 0;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
      const delta = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      target += delta * unit / (cardWidth * 1.15);
      lastInteraction = performance.now();
      wake();
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(settle, 150);
    };
    const onMotionChange = () => {
      reduced = reducedMotion.matches;
      if (reduced) { target = Math.round(position); position = target; settle(); paint(); }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) wake();
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    observer.observe(viewport);
    reducedMotion.addEventListener("change", onMotionChange);
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerTilt);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
    viewport.addEventListener("lostpointercapture", release);
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd);
    viewport.addEventListener("touchcancel", onTouchEnd);
    viewport.addEventListener("wheel", onWheel, { passive: false, capture: true });
    resize();
    return () => {
      rootStyle.setProperty("overscroll-behavior-x", previousRootOverscroll);
      bodyStyle.setProperty("overscroll-behavior-x", previousBodyOverscroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(snapTimer);
      resizeObserver.disconnect();
      observer.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerTilt);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", release);
      viewport.removeEventListener("pointercancel", release);
      viewport.removeEventListener("lostpointercapture", release);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
      viewport.removeEventListener("wheel", onWheel);
      moveRef.current = () => {};
    };
  }, [count]);

  const active = entries[activeIndex];
  if (!active) return null;
  const move = (direction: number) => moveRef.current(Math.round(positionRef.current) + direction);
  return (
    <section className="journal-ring-stage" aria-label="Journals 画廊"
      aria-roledescription="轮播" onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        suppressClickRef.current = false;
        if (event.key === "Home") moveRef.current(0);
        else if (event.key === "End") moveRef.current(count - 1);
        else move(event.key === "ArrowRight" ? 1 : -1);
      }}>
      <div className="journal-ring__masthead" aria-hidden="true">
        <h1 className="journal-ring__heading">Journals</h1>
      </div>
      <div ref={viewportRef} className="journal-ring__viewport" onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClickRef.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
        }}>
        <div className="journal-ring">
          {entries.map((entry, index) => {
            const ratio = entry.cover ? entry.cover.dimensions.width / entry.cover.dimensions.height : 4 / 3;
            const isActive = index === activeIndex;
            return (
              <Link key={entry.slug} ref={(el) => { cardRefs.current[index] = el; }}
                to={"/journals/" + entry.slug} className="journal-ring__card"
                data-active={isActive ? "true" : "false"}
                style={{ "--photo-ratio": String(ratio) } as CSSProperties}
                aria-label={isActive ? entry.title : undefined} aria-hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={(event) => {
                  if (isActive || event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  const distance = wrap(index - positionRef.current + count / 2, count) - count / 2;
                  moveRef.current(positionRef.current + distance);
                }}>
                <span className="journal-ring__fallback font-serif">{entry.title}</span>
                {entry.cover ? <img src={transformImageUrl(entry.cover.media.path, 960)}
                  alt="" loading={Math.abs(wrap(index - activeIndex + count / 2, count) - count / 2) < 3 ? "eager" : "lazy"}
                  decoding="async" draggable={false}
                  onError={(event) => { event.currentTarget.style.opacity = "0"; }} /> : null}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="journal-ring__meta">
        <div className="journal-ring__caption" aria-live="polite" aria-atomic="true">
          <span className="journal-ring__count">{String(activeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
          <time className="journal-ring__date" dateTime={active.createdAt}>{active.createdAt.replaceAll("-", ".")}</time>
          <h2 className="journal-ring__title font-serif"><Link to={"/journals/" + active.slug}>{active.title}</Link></h2>
        </div>
        <button type="button" className="journal-ring__arrow journal-ring__arrow--previous" aria-label="上一篇" onClick={() => move(-1)} disabled={count < 2}>
          <ChevronLeft size={22} strokeWidth={1.25} />
        </button>
        <button type="button" className="journal-ring__arrow journal-ring__arrow--next" aria-label="下一篇" onClick={() => move(1)} disabled={count < 2}>
          <ChevronRight size={22} strokeWidth={1.25} />
        </button>
      </div>
    </section>
  );
}
