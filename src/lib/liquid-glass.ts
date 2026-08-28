// Adapted from liquid-glass-web-react by PallavAg (MIT); kept local so the
// overlay composition and filter output remain under site control.
// @ts-nocheck
"use client";

// src/react/LiquidGlass.tsx
import {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef
} from "react";

export type LiquidGlassHandle = {
  element: HTMLDivElement | null;
  engine: LiquidGlassEngine | null;
  setPosition: (x: number, y: number) => void;
};

type LiquidGlassProps = {
  children: ReactNode;
  [key: string]: any;
};

// src/core/math.ts
function erf(x) {
  return Math.tanh(1.7724538509 * x);
}
function averageDomeGradient(R, half) {
  let sum = 0;
  for (let i = 0; i <= 200; i++) {
    const s = i / 200 * half;
    const v = s / Math.sqrt(R * R - s * s);
    sum += i === 0 || i === 200 ? 0.5 * v : v;
  }
  return sum / 200;
}
function computeDomeConstants(depth, halfWidth, halfHeight) {
  const d = Math.max(0.01, Math.min(depth, Math.min(halfWidth, halfHeight) - 1));
  const Rx = (halfWidth * halfWidth + d * d) / (2 * d);
  const Ry = (halfHeight * halfHeight + d * d) / (2 * d);
  const gx = averageDomeGradient(Rx, halfWidth);
  const gy = averageDomeGradient(Ry, halfHeight);
  return {
    Rx,
    Ry,
    scaleX: gx > 0 ? 0.5 / gx : 1,
    scaleY: gy > 0 ? 0.5 / gy : 1
  };
}
function domeGradient(x, R, scale) {
  const s = Math.min(x, 0.999 * R);
  return s / Math.sqrt(R * R - s * s) * scale;
}

// src/core/displacementMap.ts
function computeDisplacementMap(p) {
  const size = p.size;
  const half = size >> 1;
  const data = new Uint8ClampedArray(size * size * 4);
  const hw = p.halfWidth;
  const hh = p.halfHeight;
  const cornerR = Math.min(p.radius, Math.min(hw, hh));
  const innerW = Math.max(0, hw - p.depth);
  const innerH = Math.max(0, hh - p.depth);
  const innerR = Math.max(0, Math.min(p.radius, Math.min(innerW, innerH)));
  const falloffK = p.depth > 0 ? 1 / (p.depth * Math.SQRT2) : 1e6;
  const hasSpecular = p.glow > 0 || p.edgeHighlight > 0;
  const theta = p.specularAngle * Math.PI / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const glowLo = (1 - p.glowSpread) * Math.SQRT2;
  const glowRange = p.glowSpread * Math.SQRT2;
  const glowInv = glowRange > 1e-3 ? 1 / glowRange : 0;
  const edgeInv = p.edgeWidth > 0 ? 1 / p.edgeWidth : 0;
  const stepX = 2 * hw / size;
  const stepY = 2 * hh / size;
  const invW = 1 / hw;
  const invH = 1 / hh;
  const dome = p.domeDepth > 0 ? computeDomeConstants(p.domeDepth, hw, hh) : null;
  let domeColumns = null;
  if (dome) {
    domeColumns = new Float32Array(half);
    const rr = dome.Rx * dome.Rx;
    const cap = 0.999 * dome.Rx;
    for (let c = 0; c < half; c++) {
      const ax = -((c + 0.5) * stepX - hw);
      const s = ax < cap ? ax : cap;
      domeColumns[c] = s / Math.sqrt(rr - s * s) * dome.scaleX;
    }
  }
  const doSplay = p.splay < 1;
  const splayMix = 1 - p.splay;
  const splayHalf = 0.5 * Math.min(hw, hh);
  const splayInv = splayHalf > 0 ? 1 / splayHalf : 0;
  for (let row = 0; row < half; row++) {
    const mirrorRow = size - 1 - row;
    const ay = -((row + 0.5) * stepY - hh);
    const sdfY = ay - hh + cornerR;
    const fallY = ay - innerH + innerR;
    const gradY = dome ? domeGradient(ay, dome.Ry, dome.scaleY) : ay * invH > 1 ? 1 : ay * invH;
    const clampY = ay * invH > 1 ? 1 : ay * invH;
    const splayY = doSplay ? Math.max(0, 1 - (hh - ay) * splayInv) : 0;
    for (let col = 0; col < half; col++) {
      const mirrorCol = size - 1 - col;
      const ax = -((col + 0.5) * stepX - hw);
      const sdfX = ax - hw + cornerR;
      const ox = sdfX > 0 ? sdfX : 0;
      const oy = sdfY > 0 ? sdfY : 0;
      const oo = ox * ox + oy * oy;
      const sdf = (oo > 0 ? Math.sqrt(oo) : 0) + (sdfX > sdfY ? sdfX > 0 ? 0 : sdfX : sdfY > 0 ? 0 : sdfY) - cornerR;
      const iTL = (row * size + col) * 4;
      const iTR = (row * size + mirrorCol) * 4;
      const iBL = (mirrorRow * size + col) * 4;
      const iBR = (mirrorRow * size + mirrorCol) * 4;
      if (sdf >= 0) {
        data[iTL] = data[iTL + 1] = data[iTL + 2] = 128;
        data[iTR] = data[iTR + 1] = data[iTR + 2] = 128;
        data[iBL] = data[iBL + 1] = data[iBL + 2] = 128;
        data[iBR] = data[iBR + 1] = data[iBR + 2] = 128;
        data[iTL + 3] = data[iTR + 3] = data[iBL + 3] = data[iBR + 3] = 0;
        continue;
      }
      let dispX = dome && domeColumns ? domeColumns[col] : ax * invW > 1 ? 1 : ax * invW;
      let dispY = gradY;
      if (doSplay) {
        const attX = splayY * splayMix;
        const attY = Math.max(0, 1 - (hw - ax) * splayInv) * splayMix;
        if (attX > 1e-3 || attY > 1e-3) {
          const x0 = dispX;
          const y0 = dispY;
          dispX = x0 * (1 - attX);
          dispY = y0 * (1 - attY);
          const m0 = Math.sqrt(x0 * x0 + y0 * y0);
          const m1 = Math.sqrt(dispX * dispX + dispY * dispY);
          if (m1 > 1e-3) {
            const k = m0 / m1;
            dispX *= k;
            dispY *= k;
          }
        }
      }
      const ex = ax - innerW + innerR;
      const rx = ex > 0 ? ex : 0;
      const ry = fallY > 0 ? fallY : 0;
      const innerSdf = Math.sqrt(rx * rx + ry * ry) + (ex > fallY ? ex > 0 ? 0 : ex : fallY > 0 ? 0 : fallY) - innerR;
      const fall = 0.5 * (1 + erf(innerSdf * falloffK));
      const hx = 0.5 * dispX * fall;
      const hy = 0.5 * dispY * fall;
      const rPlus = (0.5 + hx) * 255 + 0.5 | 0;
      const rMinus = (0.5 - hx) * 255 + 0.5 | 0;
      const gPlus = (0.5 + hy) * 255 + 0.5 | 0;
      const gMinus = (0.5 - hy) * 255 + 0.5 | 0;
      let bSum = 128;
      let bDiff = 128;
      if (hasSpecular) {
        const px = (ax * invW > 1 ? 1 : ax * invW) * cosT;
        const py = clampY * sinT;
        const projSum = Math.abs(px + py);
        const projDiff = Math.abs(px - py);
        let band = 0;
        if (p.edgeHighlight > 0) {
          band = 1 + sdf * edgeInv;
          if (band < 0) band = 0;
        }
        let vSum = 0;
        let vDiff = 0;
        if (p.glow > 0) {
          const tS = (projSum - glowLo) * glowInv;
          vSum += p.glow * Math.pow(tS < 0 ? 0 : tS > 1 ? 1 : tS, p.glowExponent) * fall;
          const tD = (projDiff - glowLo) * glowInv;
          vDiff += p.glow * Math.pow(tD < 0 ? 0 : tD > 1 ? 1 : tD, p.glowExponent) * fall;
        }
        if (p.edgeHighlight > 0) {
          vSum += p.edgeHighlight * band * Math.pow(projSum, p.edgeExponent);
          vDiff += p.edgeHighlight * band * Math.pow(projDiff, p.edgeExponent);
        }
        if (vSum > 1) vSum = 1;
        if (vDiff > 1) vDiff = 1;
        bSum = 127 * vSum + 128 + 0.5 | 0;
        bDiff = 127 * vDiff + 128 + 0.5 | 0;
      }
      data[iTL] = rPlus;
      data[iTL + 1] = gPlus;
      data[iTL + 2] = bSum;
      data[iTL + 3] = 255;
      data[iTR] = rMinus;
      data[iTR + 1] = gPlus;
      data[iTR + 2] = bDiff;
      data[iTR + 3] = 255;
      data[iBL] = rPlus;
      data[iBL + 1] = gMinus;
      data[iBL + 2] = bDiff;
      data[iBL + 3] = 255;
      data[iBR] = rMinus;
      data[iBR + 1] = gMinus;
      data[iBR + 2] = bSum;
      data[iBR + 3] = 255;
    }
  }
  return data;
}
function renderDisplacementMap(p, canvas = document.createElement("canvas")) {
  canvas.width = p.size;
  canvas.height = p.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(p.size, p.size);
  image.data.set(computeDisplacementMap(p));
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

// src/core/types.ts
var DEFAULT_OPTIONS = {
  width: 160,
  height: 120,
  radius: "auto",
  strength: 0.1,
  chromaticAberration: 0.2,
  blur: 0,
  depth: 10,
  curvature: 0.65,
  splay: 1,
  glow: 0.1,
  glowSpread: 1,
  glowExponent: 1.5,
  edgeHighlight: 0.25,
  edgeWidth: 3,
  edgeExponent: 1.5,
  specular: 1,
  specularAngle: 45,
  quality: 512
};

// src/core/engine.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var instanceCounter = 0;
var UA = typeof navigator !== "undefined" ? navigator.userAgent : "";
var IS_IOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(UA) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
var IS_SAFARI = IS_IOS || /^((?!chrome|chromium|android).)*safari/i.test(UA);
function fe(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const key of Object.keys(attrs)) el.setAttribute(key, String(attrs[key]));
  return el;
}
var LiquidGlassEngine = class {
  constructor(host, options) {
    this.filterEl = null;
    this.feImageEl = null;
    this.lensRegionEls = [];
    this.dispEls = [];
    this.blurEl = null;
    this.specularEl = null;
    this.x = 0.5;
    this.y = 0.5;
    this.mapUrl = "";
    this.mapCanvas = null;
    this.version = 0;
    this.regenQueued = false;
    this.rafId = null;
    this.resizeObserver = null;
    this.destroyed = false;
    this.warnedFootprint = false;
    /** Called whenever a new displacement map has been generated. */
    this.onMap = null;
    this.host = host;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.id = `liquid-glass-web-react-${++instanceCounter}`;
    this.buildFilter();
    this.regenerate();
    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(host.container);
    if (host.filtered !== host.container) this.resizeObserver.observe(host.filtered);
  }
  /** Lens center as fractions (0–1) of the glass surface (filtered box). */
  setPosition(x, y) {
    this.x = Math.min(1, Math.max(0, x));
    this.y = Math.min(1, Math.max(0, y));
    this.host.container.style.setProperty("--liquid-glass-x", `${this.x * 100}%`);
    this.host.container.style.setProperty("--liquid-glass-y", `${this.y * 100}%`);
    this.update();
  }
  getPosition() {
    return { x: this.x, y: this.y };
  }
  /** Latest generated displacement map as a PNG data URL. */
  getMapUrl() {
    return this.mapUrl;
  }
  /** Merge new options; regenerates the map only when the shape changed. */
  setOptions(partial) {
    const prev = this.options;
    const next = { ...prev, ...partial };
    this.options = next;
    const needsRegen = [
      "width",
      "height",
      "radius",
      "depth",
      "curvature",
      "splay",
      "glow",
      "glowSpread",
      "glowExponent",
      "edgeHighlight",
      "edgeWidth",
      "edgeExponent",
      "specularAngle",
      "quality"
    ].some((key) => prev[key] !== next[key]);
    if (needsRegen) this.scheduleRegenerate();
    else this.update();
  }
  getOptions() {
    return { ...this.options };
  }
  /** Re-measure and re-apply everything (e.g. after layout changes). */
  refresh() {
    this.update();
  }
  destroy() {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.host.filtered.style.filter = "";
    this.host.defsHost.replaceChildren();
    if (this.mapCanvas) {
      this.mapCanvas.width = 0;
      this.mapCanvas.height = 0;
      this.mapCanvas = null;
    }
  }
  // -- internals ----------------------------------------------------------
  get halfWidth() {
    return this.options.width / 2;
  }
  get halfHeight() {
    return this.options.height / 2;
  }
  get cornerRadius() {
    const { radius } = this.options;
    const max = Math.min(this.halfWidth, this.halfHeight);
    return radius === "auto" ? max : Math.min(radius, max);
  }
  /**
   * Builds the filter primitive chain:
   *
   *   neutral flood ─ feImage(map at lens) ─▶ map
   *   source ─ feGaussianBlur(optional) ─▶ blurred
   *   3 × feDisplacementMap at offset scales, one per RGB channel,
   *     recombined additively ─▶ chromatic refraction
   *   map blue channel ─▶ specular highlight, composited over
   *   lens punched out of source, refraction composited back in
   *
   * Everything tagged `data-lens` is restricted to the lens subregion, so
   * content outside the lens is the browser's original render and the
   * filter's cost scales with the lens, not the container.
   */
  buildFilter() {
    const units = "userSpaceOnUse";
    const filter = fe("filter", {
      filterUnits: units,
      primitiveUnits: units,
      "color-interpolation-filters": "sRGB",
      x: 0,
      y: 0,
      width: 1,
      // userSpaceOnUse sizes are set in px on every update
      height: 1
    });
    filter.appendChild(
      fe("feFlood", { "flood-color": "rgb(128,128,128)", "flood-opacity": 1, result: "mapBg" })
    );
    this.feImageEl = fe("feImage", {
      "data-lens": "",
      preserveAspectRatio: "none",
      result: "rawMap"
    });
    filter.appendChild(this.feImageEl);
    filter.appendChild(fe("feComposite", { in: "rawMap", in2: "mapBg", operator: "over", result: "map" }));
    this.blurEl = fe("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "0 0", result: "blurred" });
    filter.appendChild(this.blurEl);
    const channelMatrices = [
      "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
      "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
      "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
    ];
    const results = ["dispR", "dispG", "dispB"];
    for (let i = 0; i < 3; i++) {
      filter.appendChild(
        fe("feDisplacementMap", {
          "data-lens": "",
          in: "SourceGraphic",
          in2: "map",
          scale: 0,
          xChannelSelector: "R",
          yChannelSelector: "G"
        })
      );
      filter.appendChild(fe("feColorMatrix", { type: "matrix", values: channelMatrices[i], result: results[i] }));
    }
    filter.appendChild(
      fe("feComposite", { in: "dispR", in2: "dispG", operator: "arithmetic", k1: 0, k2: 1, k3: 1, k4: 0 })
    );
    filter.appendChild(
      fe("feComposite", { in2: "dispB", operator: "arithmetic", k1: 0, k2: 1, k3: 1, k4: 0, result: "lensResult" })
    );
    filter.appendChild(
      fe("feColorMatrix", {
        in: IS_SAFARI ? "rawMap" : "map",
        type: "matrix",
        values: `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ${-128 / 255}`,
        result: "specMask"
      })
    );
    this.specularEl = fe("feComposite", {
      in: "specMask",
      in2: "lensResult",
      operator: "arithmetic",
      k1: 0,
      k2: this.options.specular,
      k3: 1,
      k4: 0,
      result: "lensResult"
    });
    filter.appendChild(this.specularEl);
    filter.appendChild(
      fe("feColorMatrix", {
        in: "rawMap",
        type: "matrix",
        values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
        result: "lensShape"
      })
    );
    filter.appendChild(
      fe("feComposite", { in: "lensResult", in2: "lensShape", operator: "in", result: "lensResult" })
    );
    // Keep the overlay transparent outside the lens so a base image can sit underneath it.
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    const defs = document.createElementNS(SVG_NS, "defs");
    defs.appendChild(filter);
    svg.appendChild(defs);
    this.host.defsHost.replaceChildren(svg);
    this.filterEl = filter;
    this.lensRegionEls = Array.from(filter.querySelectorAll("[data-lens]"));
    this.dispEls = Array.from(filter.querySelectorAll("feDisplacementMap"));
  }
  scheduleRegenerate() {
    if (this.regenQueued) return;
    this.regenQueued = true;
    this.rafId = requestAnimationFrame(() => {
      this.regenQueued = false;
      this.rafId = null;
      if (!this.destroyed) this.regenerate();
    });
  }
  regenerate() {
    const o = this.options;
    const hw = this.halfWidth;
    const hh = this.halfHeight;
    if (!this.mapCanvas) this.mapCanvas = document.createElement("canvas");
    this.mapUrl = renderDisplacementMap(
      {
        size: o.quality,
        halfWidth: hw,
        halfHeight: hh,
        radius: this.cornerRadius,
        depth: o.depth,
        domeDepth: Math.max(0, Math.min(1, o.curvature)) * Math.min(hw, hh),
        splay: o.splay,
        glow: o.glow,
        glowSpread: o.glowSpread,
        glowExponent: o.glowExponent,
        edgeHighlight: o.edgeHighlight,
        edgeWidth: o.edgeWidth,
        edgeExponent: o.edgeExponent,
        specularAngle: o.specularAngle
      },
      this.mapCanvas
    );
    this.feImageEl?.setAttribute("href", this.mapUrl);
    this.onMap?.(this.mapUrl);
    this.update();
  }
  /**
   * Fast path: repositions the lens subregion, updates scales/blur, bumps
   * the filter ID. Safari caches filter output by ID and keeps serving stale
   * results otherwise, so every update assigns a fresh one.
   */
  update() {
    if (!this.filterEl || this.destroyed) return;
    const rect = this.host.filtered.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (W <= 0 || H <= 0) return;
    if (IS_SAFARI && !this.warnedFootprint && W * H > 25e5) {
      this.warnedFootprint = true;
      console.warn(
        `[liquid-glass-web-react] Refracting a ${Math.round(W)}\xD7${Math.round(H)}px element. Safari limits the source size an SVG filter can process and may degrade or drop the effect \u2014 consider scoping the glass to a smaller region on Safari/iOS.`
      );
    }
    const o = this.options;
    const hw = this.halfWidth;
    const hh = this.halfHeight;
    const left = this.x * W - hw;
    const top = this.y * H - hh;
    const bias = 0.5;
    const sx = 1;
    const sy = 1;
    this.filterEl.setAttribute("x", "0");
    this.filterEl.setAttribute("y", "0");
    this.filterEl.setAttribute("width", String(W));
    this.filterEl.setAttribute("height", String(H));
    const fx = String((left + bias) * sx);
    const fy = String((top + bias) * sy);
    const fw = String(Math.max(0, 2 * hw - 2 * bias) * sx);
    const fh = String(Math.max(0, 2 * hh - 2 * bias) * sy);
    for (const el of this.lensRegionEls) {
      el.setAttribute("x", fx);
      el.setAttribute("y", fy);
      el.setAttribute("width", fw);
      el.setAttribute("height", fh);
    }
    const s = o.strength * Math.min(W, H);
    const c = o.chromaticAberration;
    const scales = [s * (1 + 0.2 * c), s * (1 + 0.1 * c), s];
    const blurInput = o.blur > 0 ? "blurred" : "SourceGraphic";
    for (let i = 0; i < this.dispEls.length; i++) {
      this.dispEls[i].setAttribute("scale", String(scales[i]));
      this.dispEls[i].setAttribute("in", blurInput);
    }
    this.blurEl?.setAttribute("stdDeviation", `${o.blur} ${o.blur}`);
    this.specularEl?.setAttribute("k2", String(o.specular));
    if (IS_SAFARI) {
      this.filterEl.id = `${this.id}-v${++this.version}`;
      this.host.filtered.style.filter = `url(#${this.filterEl.id})`;
    } else if (!this.filterEl.id) {
      this.filterEl.id = this.id;
      this.host.filtered.style.filter = `url(#${this.id})`;
    }
    const shadow = this.host.shadow;
    if (shadow) {
      let ox = 0;
      let oy = 0;
      if (this.host.filtered !== this.host.container) {
        const crect = this.host.container.getBoundingClientRect();
        ox = rect.left - crect.left;
        oy = rect.top - crect.top;
      }
      shadow.style.transform = `translate(${ox + left}px, ${oy + top}px)`;
      shadow.style.width = `${2 * hw}px`;
      shadow.style.height = `${2 * hh}px`;
      shadow.style.borderRadius = `${this.cornerRadius}px`;
    }
  }
};

// src/react/LiquidGlass.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_SHADOW = "0 0 0 1px rgba(255,255,255,0.25), 0 8px 24px rgba(0,0,0,0.35)";
var OPTION_KEYS = Object.keys(DEFAULT_OPTIONS);
function pickOptions(props) {
  const out = {};
  for (const key of OPTION_KEYS) {
    if (props[key] !== void 0) out[key] = props[key];
  }
  return out;
}
var LiquidGlass = forwardRef<LiquidGlassHandle, LiquidGlassProps>(
  function LiquidGlass2(props, ref) {
    const {
      children,
      magnification = 1,
      x = 0.5,
      y = 0.5,
      draggable = false,
      shadow = true,
      onMove,
      onMapGenerated,
      // engine options
      width,
      height,
      radius,
      strength,
      chromaticAberration,
      blur,
      depth,
      curvature,
      splay,
      glow,
      glowSpread,
      glowExponent,
      edgeHighlight,
      edgeWidth,
      edgeExponent,
      specular,
      specularAngle,
      quality,
      // div props
      style,
      ...rest
    } = props;
    const options = pickOptions({
      width,
      height,
      radius,
      strength,
      chromaticAberration,
      blur,
      depth,
      curvature,
      splay,
      glow,
      glowSpread,
      glowExponent,
      edgeHighlight,
      edgeWidth,
      edgeExponent,
      specular,
      specularAngle,
      quality
    });
    const containerRef = useRef(null);
    const filteredRef = useRef(null);
    const defsRef = useRef(null);
    const shadowRef = useRef(null);
    const engineRef = useRef(null);
    const draggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const onMoveRef = useRef(onMove);
    onMoveRef.current = onMove;
    const onMapRef = useRef(onMapGenerated);
    onMapRef.current = onMapGenerated;
    const initialRef = useRef({ options, x, y });
    initialRef.current.options = options;
    useLayoutEffect(() => {
      const container = containerRef.current;
      const filtered = filteredRef.current;
      const defsHost = defsRef.current;
      if (!container || !filtered || !defsHost) return;
      const engine = new LiquidGlassEngine(
        { container, filtered, defsHost, shadow: shadowRef.current },
        initialRef.current.options
      );
      engine.onMap = (url) => onMapRef.current?.(url);
      engine.setPosition(initialRef.current.x, initialRef.current.y);
      engineRef.current = engine;
      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    }, []);
    useEffect(() => {
      engineRef.current?.setOptions(options);
    }, [...OPTION_KEYS.map((key) => options[key])]);
    const prevPosRef = useRef(null);
    useEffect(() => {
      initialRef.current.x = x;
      initialRef.current.y = y;
      const prev = prevPosRef.current;
      prevPosRef.current = { x, y };
      if (prev === null || prev.x === x && prev.y === y) return;
      if (!draggingRef.current) engineRef.current?.setPosition(x, y);
    }, [x, y]);
    useImperativeHandle(ref, () => ({
      get element() {
        return containerRef.current;
      },
      get engine() {
        return engineRef.current;
      },
      setPosition: (px, py) => engineRef.current?.setPosition(px, py)
    }));
    const handlePointerDown = (e) => {
      if (!draggable || !engineRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = engineRef.current.getPosition();
      draggingRef.current = true;
      dragOffsetRef.current = {
        x: (e.clientX - rect.left) / rect.width - pos.x,
        y: (e.clientY - rect.top) / rect.height - pos.y
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const handlePointerMove = (e) => {
      if (!draggingRef.current || !engineRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - dragOffsetRef.current.x;
      const ny = (e.clientY - rect.top) / rect.height - dragOffsetRef.current.y;
      engineRef.current.setPosition(nx, ny);
      const pos = engineRef.current.getPosition();
      onMoveRef.current?.(pos.x, pos.y);
      e.preventDefault();
    };
    const handlePointerEnd = () => {
      draggingRef.current = false;
    };
    const containerStyle = {
      position: "relative",
      ...draggable ? { cursor: "grab", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } : null,
      ...style
    };
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: containerRef,
        "data-liquid-glass": "",
        style: containerStyle,
        onPointerDown: draggable ? handlePointerDown : void 0,
        onPointerMove: draggable ? handlePointerMove : void 0,
        onPointerUp: draggable ? handlePointerEnd : void 0,
        onPointerCancel: draggable ? handlePointerEnd : void 0,
        ...rest,
        children: [
          /* @__PURE__ */ jsx("div", {
            ref: filteredRef,
            style: { height: "100%", position: "relative", width: "100%", willChange: "filter" },
            children: /* @__PURE__ */ jsx("div", {
              style: {
                inset: 0,
                position: "absolute",
                transform: `scale(${magnification})`,
                transformOrigin: "var(--liquid-glass-x) var(--liquid-glass-y)"
              },
              children
            })
          }),
          /* @__PURE__ */ jsx("div", { ref: defsRef, style: { position: "absolute", inset: 0, pointerEvents: "none" }, "aria-hidden": true }),
          shadow !== false && /* @__PURE__ */ jsx(
            "div",
            {
              ref: shadowRef,
              "aria-hidden": true,
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
                willChange: "transform",
                boxShadow: shadow === true ? DEFAULT_SHADOW : shadow
              }
            }
          )
        ]
      }
    );
  }
);
export {
  LiquidGlass
};
//# sourceMappingURL=index.js.map
