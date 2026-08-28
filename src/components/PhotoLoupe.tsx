import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { LiquidGlass, type LiquidGlassHandle } from "../lib/liquid-glass";
import "./PhotoLoupe.css";

type Position = { x: number; y: number };

type PhotoLoupeProps = {
  children: ReactNode;
  sample: ReactNode;
  className?: string;
};

const REST_POSITION = { x: 0.92, y: 0.98 };
const LENS_SIZE = 196;
const RETURN_DURATION = 420;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A refractive desk loupe that samples one continuous visual surface. */
export function PhotoLoupe({ children, sample, className }: PhotoLoupeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<LiquidGlassHandle>(null);
  const animationRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const restPositionRef = useRef<Position>(REST_POSITION);
  const atRestRef = useRef(true);

  const cancelReturn = () => {
    if (animationRef.current === null) return;
    window.cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  };

  const positionLens = (position: Position) => {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty("--loupe-x", `${position.x * 100}%`);
    root.style.setProperty("--loupe-y", `${position.y * 100}%`);
  };

  const setPosition = (position: Position) => {
    const engine = glassRef.current?.engine;
    if (!engine) return;
    engine.setPosition(position.x, position.y);
    positionLens(engine.getPosition());
  };

  const getRestPosition = (): Position => {
    const root = rootRef.current;
    const glass = glassRef.current?.element;
    if (!root || !glass) return REST_POSITION;
    const width = glass.clientWidth;
    const height = glass.clientHeight;
    if (!width || !height) return REST_POSITION;

    const glassRect = glass.getBoundingClientRect();
    const targetRect = root.querySelector<HTMLElement>("[data-loupe-rest-target]")
      ?.getBoundingClientRect();
    const target = targetRect
      ? {
          x: (targetRect.left - glassRect.left + targetRect.width * REST_POSITION.x) / width,
          y: (targetRect.top - glassRect.top + targetRect.height * REST_POSITION.y) / height,
        }
      : REST_POSITION;
    const restClearance = LENS_SIZE * 0.32;

    return {
      x: clamp(target.x, restClearance / width, 1 - restClearance / width),
      y: clamp(target.y, restClearance / height, 1 - restClearance / height),
    };
  };

  const returnToRest = () => {
    cancelReturn();
    const engine = glassRef.current?.engine;
    if (!engine) return;

    const start = engine.getPosition();
    const target = restPositionRef.current;
    atRestRef.current = false;

    if (prefersReducedMotion()) {
      setPosition(target);
      atRestRef.current = true;
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = clamp((now - startedAt) / RETURN_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      setPosition({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
      });
      if (progress < 1) {
        animationRef.current = window.requestAnimationFrame(step);
      } else {
        animationRef.current = null;
        atRestRef.current = true;
      }
    };
    animationRef.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    const updateLayout = () => {
      const nextRest = getRestPosition();
      restPositionRef.current = nextRest;
      const engine = glassRef.current?.engine;
      if (!engine) return;
      if (atRestRef.current) setPosition(nextRest);
      else positionLens(engine.getPosition());
    };

    updateLayout();
    if (typeof ResizeObserver === "undefined" || !rootRef.current) return undefined;
    const observer = new ResizeObserver(updateLayout);
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    const root = rootRef.current;
    const engine = glassRef.current?.engine;
    if (!root || !engine) return;

    cancelReturn();
    atRestRef.current = false;
    draggingRef.current = true;
    const rect = root.getBoundingClientRect();
    const position = engine.getPosition();
    dragOffsetRef.current = {
      x: (event.clientX - rect.left) / rect.width - position.x,
      y: (event.clientY - rect.top) / rect.height - position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const root = rootRef.current;
    if (!draggingRef.current || !root) return;

    const rect = root.getBoundingClientRect();
    setPosition({
      x: (event.clientX - rect.left) / rect.width - dragOffsetRef.current.x,
      y: (event.clientY - rect.top) / rect.height - dragOffsetRef.current.y,
    });
    event.preventDefault();
  };

  const handlePointerEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    returnToRest();
  };

  const rootClassName = ["photo-loupe", className].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClassName}
      role="group"
      aria-label="桌面放大镜"
    >
      {children}
      <LiquidGlass
        ref={glassRef}
        className="photo-loupe__glass"
        style={{ position: "absolute", inset: 0, cursor: "default" }}
        magnification={1}
        x={REST_POSITION.x}
        y={REST_POSITION.y}
        width={LENS_SIZE}
        height={LENS_SIZE}
        radius="auto"
        strength={0.08}
        chromaticAberration={0.7}
        depth={18}
        curvature={0.82}
        glow={0.28}
        edgeHighlight={0.58}
        edgeWidth={4}
        specular={1.2}
        specularAngle={35}
        quality={256}
        shadow="0 8px 20px rgba(12,15,14,0.24), 0 24px 44px rgba(12,15,14,0.18)"
        aria-hidden="true"
      >
        <div className="photo-loupe__source">
          <div className="photo-loupe__source-base">
            <div className="photo-loupe__source-content">{sample}</div>
          </div>
          <div className="photo-loupe__source-mid">
            <div className="photo-loupe__source-content">{sample}</div>
          </div>
          <div className="photo-loupe__source-center">
            <div className="photo-loupe__source-content">{sample}</div>
          </div>
        </div>
      </LiquidGlass>
      <span
        className="photo-loupe__hardware"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <span className="photo-loupe__transition-ring" />
        <span className="photo-loupe__rim" />
      </span>
      <span className="sr-only">按住放大镜拖动，松开后会回到右下角。</span>
    </div>
  );
}
