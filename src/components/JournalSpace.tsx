import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as THREE from "three";
import type { JournalFrontmatter, Photo } from "../lib/content";
import { imageFallbackUrl, transformImageUrl } from "../lib/media";
import "./JournalSpace.css";

export type JournalSpaceEntry = {
  index: number;
  journal: JournalFrontmatter;
  placeName: string;
  cover?: Photo;
};

type SpaceMode = "Ring" | "Flower" | "Sphere" | "Cylinder";

const SPACE_MODES: readonly SpaceMode[] = ["Ring", "Flower", "Sphere", "Cylinder"];
const SPLIT_LAYOUT_QUERY = "(min-width: 1024px) and (min-height: 560px) and (min-aspect-ratio: 6 / 5)";
const CANVAS_RGB = new THREE.Vector3(232 / 255, 223 / 255, 210 / 255);
const CAMERA_FOV = 50;
const HALF_TAN_V = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV * 0.5));
const FORMATION_SCALE = 5.4;
const SHAPE_SIZE = 0.42;
const WORLD_SCALE = FORMATION_SCALE * SHAPE_SIZE;
const HORIZONTAL_SPREAD = 3.55;
const FLUIDITY = 0.072;
const AUTO_ROTATE_SPEED = 0.14;
const AUTO_RESUME_DELAY_MS = 1400;

type FormationBounds = {
  rx: number;
  ry: number;
  dx: number;
  dy: number;
  depth: number;
  fillX: number;
  fillY: number;
};

const FORMATION_BOUNDS: Record<SpaceMode, FormationBounds> = {
  Ring: {
    rx: WORLD_SCALE * 1.18 + 0.54,
    ry: WORLD_SCALE * 0.24 + 0.62,
    dx: WORLD_SCALE * 0.26,
    dy: WORLD_SCALE * 1.18,
    depth: WORLD_SCALE * 1.18,
    fillX: 0.88,
    fillY: 0.72,
  },
  Flower: {
    rx: WORLD_SCALE * 1.38 + 0.62,
    ry: WORLD_SCALE * 1.38 + 0.62,
    dx: WORLD_SCALE * 0.24,
    dy: WORLD_SCALE * 0.24,
    depth: WORLD_SCALE * 0.65,
    fillX: 0.84,
    fillY: 0.74,
  },
  Sphere: {
    rx: WORLD_SCALE * 1.02 + 0.52,
    ry: WORLD_SCALE * 1.02 + 0.52,
    dx: WORLD_SCALE * 0.35,
    dy: WORLD_SCALE * 0.35,
    depth: WORLD_SCALE * 1.02,
    fillX: 0.84,
    fillY: 0.74,
  },
  Cylinder: {
    rx: WORLD_SCALE * 0.96 + 0.52,
    ry: WORLD_SCALE * 0.74 + 0.52,
    dx: WORLD_SCALE * 0.34,
    dy: WORLD_SCALE * 0.96,
    depth: WORLD_SCALE * 0.96,
    fillX: 0.84,
    fillY: 0.74,
  },
};

const RIBBON_BOUNDS: FormationBounds = {
  rx: HORIZONTAL_SPREAD * SHAPE_SIZE * 1.48,
  ry: 1.02,
  dx: 0.35,
  dy: 0.35,
  depth: WORLD_SCALE * 0.85,
  fillX: 0.88,
  fillY: 0.64,
};

function fitCameraDistance(bounds: FormationBounds, aspect: number) {
  const safeAspect = Math.max(0.35, aspect);
  const halfTanH = HALF_TAN_V * safeAspect;
  const distForWidth = bounds.dx + bounds.rx / (bounds.fillX * halfTanH);
  const distForHeight = bounds.dy + bounds.ry / (bounds.fillY * HALF_TAN_V);
  return Math.max(distForWidth, distForHeight);
}

type TargetTransform = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
};

type PlaneRecord = {
  slug: string;
  index: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  targets: Record<SpaceMode, TargetTransform>;
  horizontalTarget: TargetTransform;
  highlight: number;
  opacity: number;
  currentTexture: THREE.Texture;
  photoLoaded: boolean;
};

type JournalSpaceProps = {
  entries: JournalSpaceEntry[];
  previewSlug?: string | null;
};

function seededOffset(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value) - 0.5;
}

function wrapAngleDelta(delta: number) {
  let wrapped = (delta + Math.PI) % (Math.PI * 2);
  if (wrapped < 0) wrapped += Math.PI * 2;
  return wrapped - Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text)) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function createPlateTexture(entry: JournalSpaceEntry, aspect: number) {
  const baseHeight = 512;
  const width = Math.max(280, Math.min(768, Math.round(baseHeight * aspect)));
  const height = baseHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#f8f4eb";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(32, 33, 31, 0.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    const padX = Math.round(width * 0.1);
    const padY = Math.round(height * 0.09);

    ctx.fillStyle = "rgba(32, 33, 31, 0.48)";
    ctx.font = '500 18px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(entry.journal.createdAt.replaceAll("-", "."), padX, padY);

    ctx.fillStyle = "rgba(32, 33, 31, 0.78)";
    const titleSize = Math.round(clamp(width * 0.085, 24, 34));
    ctx.font = `400 ${titleSize}px "Iowan Old Style", "Noto Serif SC", "Songti SC", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapTextLines(ctx, entry.journal.title, width - padX * 2, 4);
    const lineHeight = titleSize * 1.38;
    const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, startY + idx * lineHeight);
    });

    ctx.fillStyle = "rgba(32, 33, 31, 0.42)";
    ctx.font = '400 16px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(entry.placeName, width / 2, height - padY);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function buildFormationTargets(index: number, total: number): Record<SpaceMode, TargetTransform> {
  const dummy = new THREE.Object3D();

  // Ring: elliptical orbit facing outward so photographs are never mirrored.
  // Start index 0 directly in front (+Z) so the latest journal opens at center stage.
  const ringAngle = (index / Math.max(1, total)) * Math.PI * 2;
  const ringPos = new THREE.Vector3(
    Math.sin(ringAngle) * FORMATION_SCALE * 1.08,
    seededOffset(index, 1) * FORMATION_SCALE * 0.34,
    Math.cos(ringAngle) * FORMATION_SCALE * 1.18,
  );
  dummy.position.copy(ringPos);
  dummy.lookAt(0, ringPos.y, 0);
  dummy.rotateY(Math.PI);
  const ringTarget: TargetTransform = {
    position: ringPos,
    quaternion: dummy.quaternion.clone(),
    scale: 1,
  };

  // Flower: phyllotaxis golden-angle spiral with gentle depth wave.
  const t = index / Math.max(1, total - 1);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const flowerTheta = index * goldenAngle;
  const flowerRadius = Math.pow(t, 1.08) * FORMATION_SCALE * 1.38;
  const flowerPos = new THREE.Vector3(
    Math.cos(flowerTheta) * flowerRadius,
    Math.sin(flowerTheta) * flowerRadius,
    Math.sin(t * Math.PI * 4) * FORMATION_SCALE * 0.24 + (t - 0.5) * 0.45,
  );
  dummy.position.copy(flowerPos);
  dummy.lookAt(
    Math.cos(flowerTheta) * flowerRadius * 1.55,
    Math.sin(flowerTheta) * flowerRadius * 1.55,
    12 + FORMATION_SCALE,
  );
  const flowerTarget: TargetTransform = {
    position: flowerPos,
    quaternion: dummy.quaternion.clone(),
    scale: 0.56 + t * 0.64,
  };

  // Sphere: Fibonacci lattice facing outward.
  const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(1, total));
  const sphereTheta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5);
  const sphereRadius = FORMATION_SCALE * 1.02;
  const spherePos = new THREE.Vector3(
    sphereRadius * Math.cos(sphereTheta) * Math.sin(phi),
    sphereRadius * Math.cos(phi),
    sphereRadius * Math.sin(sphereTheta) * Math.sin(phi),
  );
  dummy.position.copy(spherePos);
  dummy.lookAt(0, 0, 0);
  dummy.rotateY(Math.PI);
  const sphereTarget: TargetTransform = {
    position: spherePos,
    quaternion: dummy.quaternion.clone(),
    scale: 0.94,
  };

  // Cylinder: staggered multi-ring column facing outward.
  const numRings = Math.max(3, Math.round(Math.sqrt(total) * 0.72));
  const perRing = Math.ceil(total / numRings);
  const ringIndex = Math.floor(index / perRing);
  const indexInRing = index % perRing;
  const cylAngle = (indexInRing / perRing) * Math.PI * 2 + ringIndex * 0.38;
  const cylRadius = FORMATION_SCALE * 0.96;
  const cylHeight = FORMATION_SCALE * 1.44;
  const cylY = numRings > 1 ? (0.5 - ringIndex / (numRings - 1)) * cylHeight : 0;
  const cylPos = new THREE.Vector3(
    Math.sin(cylAngle) * cylRadius,
    cylY,
    Math.cos(cylAngle) * cylRadius,
  );
  dummy.position.copy(cylPos);
  dummy.lookAt(0, cylY, 0);
  dummy.rotateY(Math.PI);
  const cylinderTarget: TargetTransform = {
    position: cylPos,
    quaternion: dummy.quaternion.clone(),
    scale: 0.84,
  };

  return {
    Ring: ringTarget,
    Flower: flowerTarget,
    Sphere: sphereTarget,
    Cylinder: cylinderTarget,
  };
}

function createPlaneMaterial(texture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uCanvasColor: { value: CANVAS_RGB },
      uHighlight: { value: 0 },
      uOpacity: { value: 1 },
      uIsPlaceholder: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uCanvasColor;
      uniform float uHighlight;
      uniform float uOpacity;
      uniform float uIsPlaceholder;
      varying vec2 vUv;

      void main() {
        vec4 texColor = texture2D(uMap, vUv);
        float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        float desatAmount = (1.0 - uIsPlaceholder) * 0.72;
        vec3 muted = mix(texColor.rgb, vec3(gray), desatAmount);
        vec3 softened = mix(muted, uCanvasColor, (1.0 - uIsPlaceholder) * 0.12);
        float depthFog = clamp(1.0 - uOpacity, 0.0, 1.0);
        vec3 fogged = mix(softened, uCanvasColor, depthFog * 0.78);
        vec3 finalColor = mix(fogged, texColor.rgb, uHighlight);
        float finalAlpha = mix(uOpacity, 1.0, uHighlight) * texColor.a;
        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export default function JournalSpace({
  entries,
  previewSlug = null,
}: JournalSpaceProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const modeRefs = useRef<Partial<Record<SpaceMode, HTMLButtonElement | null>>>({});
  const resetViewRef = useRef<() => void>(() => {});
  const [mode, setMode] = useState<SpaceMode>("Ring");
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  const [frontSlug, setFrontSlug] = useState(entries[0]?.journal.slug ?? "");
  const [canvasHoverSlug, setCanvasHoverSlug] = useState<string | null>(null);

  const modeRef = useRef<SpaceMode>(mode);
  const previewSlugRef = useRef<string | null>(previewSlug);
  const navigateRef = useRef(navigate);

  modeRef.current = mode;
  previewSlugRef.current = previewSlug;
  navigateRef.current = navigate;

  const syncUnderline = useCallback((activeMode: SpaceMode) => {
    const button = modeRefs.current[activeMode];
    if (!button) return;
    setUnderline({ left: button.offsetLeft, width: button.offsetWidth });
  }, []);

  useLayoutEffect(() => {
    syncUnderline(mode);
  }, [mode, syncUnderline]);

  useEffect(() => {
    const onResize = () => syncUnderline(modeRef.current);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncUnderline]);

  useEffect(() => {
    const host = canvasHostRef.current;
    const container = containerRef.current;
    if (!host || !container || entries.length === 0) return;

    let disposed = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 120);
    camera.position.set(0, 0, 10);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = "journal-space__canvas";
    host.appendChild(renderer.domElement);

    const sceneGroup = new THREE.Group();
    sceneGroup.position.y = 0.14;
    scene.add(sceneGroup);
    const raycaster = new THREE.Raycaster();
    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const planes: PlaneRecord[] = entries.map((entry, idx) => {
      const aspect = entry.cover
        ? clamp(entry.cover.dimensions.width / entry.cover.dimensions.height, 0.55, 1.85)
        : 4 / 3;
      const areaNorm = 2.08;
      const planeWidth = areaNorm * Math.sqrt(aspect);
      const planeHeight = areaNorm / Math.sqrt(aspect);
      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const plateTexture = createPlateTexture(entry, aspect);
      const material = createPlaneMaterial(plateTexture);
      const mesh = new THREE.Mesh(geometry, material);
      const targets = buildFormationTargets(idx, entries.length);
      const horizontalTarget: TargetTransform = {
        position: new THREE.Vector3(idx * HORIZONTAL_SPREAD, 0, 0),
        quaternion: new THREE.Quaternion(),
        scale: 1.12,
      };

      mesh.position.copy(targets.Ring.position).multiplyScalar(SHAPE_SIZE);
      mesh.quaternion.copy(targets.Ring.quaternion);
      mesh.scale.setScalar(targets.Ring.scale * SHAPE_SIZE);
      sceneGroup.add(mesh);

      return {
        slug: entry.journal.slug,
        index: idx,
        mesh,
        targets,
        horizontalTarget,
        highlight: 0,
        opacity: 1,
        currentTexture: plateTexture,
        photoLoaded: false,
      };
    });

    // Load cover photographs asynchronously with single fallback to original R2 URL.
    const activeLoaders: HTMLImageElement[] = [];
    entries.forEach((entry, idx) => {
      const cover = entry.cover;
      const record = planes[idx];
      if (!cover || !record) return;

      const primaryUrl = transformImageUrl(cover.media.path, 960);
      const fallbackUrl = imageFallbackUrl(cover.media.fallbackPath || cover.media.path);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      let triedFallback = false;

      img.onload = () => {
        if (disposed || img.naturalWidth === 0) return;
        const photoTexture = new THREE.Texture(img);
        photoTexture.colorSpace = THREE.SRGBColorSpace;
        photoTexture.minFilter = THREE.LinearMipmapLinearFilter;
        photoTexture.magFilter = THREE.LinearFilter;
        photoTexture.anisotropy = maxAnisotropy;
        photoTexture.needsUpdate = true;

        const oldTexture = record.currentTexture;
        record.currentTexture = photoTexture;
        record.photoLoaded = true;
        record.mesh.material.uniforms.uMap.value = photoTexture;
        record.mesh.material.uniforms.uIsPlaceholder.value = 0;
        record.mesh.material.needsUpdate = true;
        oldTexture.dispose();
      };

      img.onerror = () => {
        if (disposed) return;
        if (!triedFallback && fallbackUrl !== primaryUrl) {
          triedFallback = true;
          img.src = fallbackUrl;
        }
      };

      img.src = primaryUrl;
      activeLoaders.push(img);
    });

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopSplitQuery = window.matchMedia(SPLIT_LAYOUT_QUERY);
    let reducedMotion = reducedMotionQuery.matches;
    let inView = true;
    let tabVisible = document.visibilityState !== "hidden";
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    let viewportWidth = Math.max(1, host.clientWidth);
    let viewportHeight = Math.max(1, host.clientHeight);
    let aspect = viewportWidth / viewportHeight;
    let cameraInitialized = false;

    let rotY = 0;
    let rotX = 0;
    let flowerSpin = 0;
    let velY = 0;
    let velX = 0;
    let targetScroll = 0;
    let currentScroll = 0;
    let targetZoom = 0;
    let currentZoom = 0;
    let pointerTiltX = 0;
    let pointerTiltY = 0;
    let hoveredLocalX = 0;
    let hoveredLocalY = 0;
    let lastInteraction = 0;
    let hoveredPlane: PlaneRecord | null = null;
    let lastReportedHover: string | null = null;
    let lastReportedFront = entries[0]?.journal.slug ?? "";

    const pointerNdc = new THREE.Vector2(99, 99);
    let pointerInside = false;
    const maxScroll = Math.max(1, entries.length);

    resetViewRef.current = () => {
      targetScroll = 0;
      targetZoom = 0;
      velY = 0;
      velX = 0;
      lastInteraction = performance.now();
    };
    let dragState: {
      id: number;
      pointerType: string;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      lastTime: number;
      moved: boolean;
      axis: "x" | "y" | null;
    } | null = null;

    const resize = () => {
      viewportWidth = Math.max(1, host.clientWidth);
      viewportHeight = Math.max(1, host.clientHeight);
      aspect = viewportWidth / viewportHeight;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(viewportWidth, viewportHeight, false);
      if (!cameraInitialized) {
        cameraInitialized = true;
        camera.position.z = fitCameraDistance(FORMATION_BOUNDS[modeRef.current], aspect);
      }
    };

    const updatePointerFromEvent = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickPlane = () => {
      if (!pointerInside) return null;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(sceneGroup.children, false);
      if (hits.length === 0) return null;
      const hit = hits[0];
      const record = planes.find((item) => item.mesh === hit.object) ?? null;
      if (record && hit.uv) {
        hoveredLocalX = (hit.uv.x - 0.5) * 2;
        hoveredLocalY = (hit.uv.y - 0.5) * 2;
      }
      return record;
    };

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerInside = true;
      updatePointerFromEvent(event.clientX, event.clientY);
    };

    const onPointerLeave = () => {
      pointerInside = false;
      pointerNdc.set(99, 99);
      hoveredLocalX = 0;
      hoveredLocalY = 0;
      if (lastReportedHover !== null) {
        lastReportedHover = null;
        setCanvasHoverSlug(null);
      }
      renderer.domElement.dataset.hovering = "false";
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (event.pointerType !== "touch") {
        pointerInside = true;
        updatePointerFromEvent(event.clientX, event.clientY);
      }
      velY = 0;
      velX = 0;
      lastInteraction = performance.now();
      dragState = {
        id: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        moved: false,
        axis: event.pointerType === "touch" ? null : "x",
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        pointerInside = true;
        updatePointerFromEvent(event.clientX, event.clientY);
      }
      if (!dragState || dragState.id !== event.pointerId) return;

      const totalDx = event.clientX - dragState.startX;
      const totalDy = event.clientY - dragState.startY;

      if (!dragState.moved && Math.hypot(totalDx, totalDy) > 7) {
        if (dragState.pointerType === "touch") {
          dragState.axis = Math.abs(totalDx) >= Math.abs(totalDy) * 0.72 ? "x" : "y";
          if (dragState.axis === "y") {
            dragState = null;
            return;
          }
        }
        dragState.moved = true;
        renderer.domElement.setPointerCapture(event.pointerId);
        renderer.domElement.dataset.dragging = "true";
      }

      if (!dragState.moved) return;
      if (dragState.pointerType === "touch") event.preventDefault();

      const dx = event.clientX - dragState.lastX;
      const dy = event.clientY - dragState.lastY;
      const dt = Math.max(8, event.timeStamp - dragState.lastTime);
      const scaleX = 2.8 / Math.max(360, viewportWidth);
      const scaleY = 1.6 / Math.max(360, viewportHeight);

      if (currentScroll >= 0.45) {
        targetScroll = clamp(targetScroll - dx * (3.4 / Math.max(360, viewportWidth)), 0, maxScroll);
        velY = 0;
        velX = 0;
      } else if (modeRef.current === "Flower") {
        flowerSpin -= dx * scaleX * 0.9;
        rotX = clamp(rotX + dy * scaleY * 0.45, -0.38, 0.38);
        velY = (-dx * scaleX * 0.9) / dt;
        velX = (dy * scaleY * 0.45) / dt;
      } else {
        rotY += dx * scaleX;
        rotX = clamp(rotX + dy * scaleY, -0.52, 0.52);
        velY = (dx * scaleX) / dt;
        velX = (dy * scaleY) / dt;
      }

      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      dragState.lastTime = event.timeStamp;
      lastInteraction = performance.now();
    };

    const onPointerRelease = (event: PointerEvent) => {
      if (!dragState || dragState.id !== event.pointerId) return;
      const wasMoved = dragState.moved;
      const wasTouch = dragState.pointerType === "touch";
      const cancelled = event.type !== "pointerup";
      const stale = event.timeStamp - dragState.lastTime > 120;
      dragState = null;
      delete renderer.domElement.dataset.dragging;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      lastInteraction = performance.now();

      if (cancelled || stale) {
        velY = 0;
        velX = 0;
      } else {
        velY = clamp(velY, -0.008, 0.008);
        velX = clamp(velX, -0.005, 0.005);
      }

      if (!wasMoved && !cancelled) {
        if (wasTouch) {
          pointerInside = true;
          updatePointerFromEvent(event.clientX, event.clientY);
        }
        const hit = pickPlane();
        if (wasTouch) {
          pointerInside = false;
          pointerNdc.set(99, 99);
        }
        if (hit) {
          navigateRef.current(`/journals/${hit.slug}`);
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      const isSplitDesktop = desktopSplitQuery.matches;
      const isPinch = event.ctrlKey;
      const isHorizontal = !isPinch && Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 1;

      if (!isSplitDesktop && !isHorizontal) return;
      event.preventDefault();
      lastInteraction = performance.now();

      if (isPinch) {
        targetZoom = clamp(targetZoom + dy * 0.0045, -0.3, 0.42);
        return;
      }

      if (isHorizontal) {
        if (targetScroll < 0.35) {
          if (modeRef.current === "Flower") {
            flowerSpin -= dx * 0.0042;
            velY = clamp(-dx * 0.00018, -0.007, 0.007);
          } else {
            rotY -= dx * 0.0048;
            velY = clamp(-dx * 0.0002, -0.008, 0.008);
          }
        } else {
          targetScroll = clamp(targetScroll + dx * 0.0045, 0, maxScroll);
        }
        return;
      }

      const scrollDelta = dy * 0.0024 + (targetScroll >= 0.4 ? dx * 0.0018 : 0);
      targetScroll = clamp(targetScroll + scrollDelta, 0, maxScroll);
    };

    // Reusable scratch vectors to avoid per-frame allocations.
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);
    const rotQuatY = new THREE.Quaternion();
    const rotQuatX = new THREE.Quaternion();
    const rotQuatZ = new THREE.Quaternion();
    const groupQuat = new THREE.Quaternion();
    const hoverEuler = new THREE.Euler();
    const hoverTiltQuat = new THREE.Quaternion();
    const spatialPos = new THREE.Vector3();
    const spatialQuat = new THREE.Quaternion();
    const ribbonPos = new THREE.Vector3();
    const targetPos = new THREE.Vector3();
    const targetQuat = new THREE.Quaternion();
    const forwardOffset = new THREE.Vector3();
    const scaleVec = new THREE.Vector3();
    const cameraLookTarget = new THREE.Vector3();

    const renderFrame = (now: number) => {
      frameId = 0;
      if (disposed || !inView || !tabVisible) return;

      const dtMs = Math.min(48, Math.max(1, now - lastTime));
      const dt = dtMs / 1000;
      lastTime = now;
      elapsed += dt;

      const activeMode = modeRef.current;

      // Raycast hover only when not dragging and pointer is inside canvas.
      hoveredPlane = !dragState?.moved && pointerInside ? pickPlane() : null;
      const nextHoverSlug = hoveredPlane?.slug ?? null;
      if (nextHoverSlug !== lastReportedHover) {
        lastReportedHover = nextHoverSlug;
        setCanvasHoverSlug(nextHoverSlug);
      }
      renderer.domElement.dataset.hovering = hoveredPlane ? "true" : "false";

      const listTargetSlug = desktopSplitQuery.matches && !pointerInside && !dragState?.moved
        ? previewSlugRef.current
        : null;
      const focusedFromList = listTargetSlug
        ? planes.find((record) => record.slug === listTargetSlug) ?? null
        : null;

      if (focusedFromList && targetScroll >= 0.45) {
        targetScroll = clamp(1 + focusedFromList.index, 1, maxScroll);
        lastInteraction = now;
      }

      const scrollLerp = reducedMotion ? 1 : 1 - Math.exp(-dtMs * 0.0085);
      currentScroll += (targetScroll - currentScroll) * scrollLerp;
      if (Math.abs(targetScroll - currentScroll) < 0.0004) currentScroll = targetScroll;
      currentZoom += (targetZoom - currentZoom) * scrollLerp;

      const unfoldProgress = clamp(currentScroll, 0, 1);
      const ribbonProgress = clamp(currentScroll - 1, 0, Math.max(0, entries.length - 1));
      const effectiveSpread = HORIZONTAL_SPREAD * SHAPE_SIZE;

      // Rotational kinematics & subtle idle drift when folded.
      if (focusedFromList && unfoldProgress < 0.45) {
        velY = 0;
        velX = 0;
        lastInteraction = now;
        const basePos = focusedFromList.targets[activeMode].position;
        const focusLerp = reducedMotion ? 1 : 1 - Math.exp(-dtMs * 0.0065);
        if (activeMode === "Flower") {
          const targetSpin = -Math.atan2(basePos.y, basePos.x) + Math.PI * 0.5;
          flowerSpin += wrapAngleDelta(targetSpin - flowerSpin) * focusLerp;
          rotX += (0 - rotX) * focusLerp;
        } else {
          const targetRotY = -Math.atan2(basePos.x, basePos.z);
          const horizDist = Math.hypot(basePos.x, basePos.z);
          const targetRotX = activeMode === "Ring"
            ? 0
            : clamp(Math.atan2(basePos.y, Math.max(0.01, horizDist)) * 0.52, -0.42, 0.42);
          rotY += wrapAngleDelta(targetRotY - rotY) * focusLerp;
          rotX += (targetRotX - rotX) * focusLerp;
        }
      } else if (!dragState?.moved) {
        if (Math.abs(velY) > 0.00004 || Math.abs(velX) > 0.00004) {
          if (activeMode === "Flower") {
            flowerSpin += velY * dtMs;
            rotX = clamp(rotX + velX * dtMs, -0.38, 0.38);
          } else {
            rotY += velY * dtMs;
            rotX = clamp(rotX + velX * dtMs, -0.52, 0.52);
          }
          const decay = Math.exp(-dtMs / 240);
          velY *= decay;
          velX *= decay;
        } else if (
          !reducedMotion
          && !hoveredPlane
          && unfoldProgress < 0.12
          && now - lastInteraction > AUTO_RESUME_DELAY_MS
        ) {
          if (activeMode === "Flower") {
            flowerSpin += AUTO_ROTATE_SPEED * 0.45 * dt;
          } else {
            rotY += AUTO_ROTATE_SPEED * dt;
          }
          // Gently relax pitch back toward level during ambient drift.
          rotX *= Math.exp(-dt * 0.8);
        }
      }

      // Gentle magnetic sculpture tilt toward cursor while hovering inside the space.
      const tiltLerp = reducedMotion ? 1 : 1 - Math.exp(-dtMs * 0.006);
      const desiredTiltY = pointerInside && !dragState?.moved && !reducedMotion
        ? clamp(pointerNdc.x, -1, 1) * 0.22 * (1 - unfoldProgress)
        : 0;
      const desiredTiltX = pointerInside && !dragState?.moved && !reducedMotion
        ? -clamp(pointerNdc.y, -1, 1) * 0.16 * (1 - unfoldProgress)
        : 0;
      pointerTiltY += (desiredTiltY - pointerTiltY) * tiltLerp;
      pointerTiltX += (desiredTiltX - pointerTiltX) * tiltLerp;

      if (activeMode === "Flower") {
        rotQuatZ.setFromAxisAngle(zAxis, flowerSpin);
        rotQuatX.setFromAxisAngle(xAxis, rotX + pointerTiltX);
        rotQuatY.setFromAxisAngle(yAxis, pointerTiltY);
        groupQuat.copy(rotQuatY).multiply(rotQuatX).multiply(rotQuatZ);
      } else {
        rotQuatY.setFromAxisAngle(yAxis, rotY + pointerTiltY);
        rotQuatX.setFromAxisAngle(xAxis, rotX + pointerTiltX);
        groupQuat.copy(rotQuatX).multiply(rotQuatY);
      }

      // Fit camera distance dynamically to aspect ratio so narrow panes keep full formation visible.
      const activeBounds = FORMATION_BOUNDS[activeMode];
      const spatialBaseZ = fitCameraDistance(activeBounds, aspect);
      const ribbonBaseZ = fitCameraDistance(RIBBON_BOUNDS, aspect);
      const baseZ = THREE.MathUtils.lerp(spatialBaseZ, ribbonBaseZ, unfoldProgress) * (1 + currentZoom);

      const visibleHalfH = baseZ * HALF_TAN_V;
      const visibleHalfW = visibleHalfH * Math.max(0.35, aspect);
      const camBaseX = ribbonProgress * effectiveSpread;
      const parallaxX = pointerInside && !reducedMotion ? clamp(pointerNdc.x, -1, 1) * visibleHalfW * 0.18 : 0;
      const parallaxY = pointerInside && !reducedMotion ? clamp(pointerNdc.y, -1, 1) * visibleHalfH * 0.14 : 0;
      const lerpAlpha = reducedMotion ? 1 : 1 - Math.exp(-dtMs * (FLUIDITY / 16.67));

      camera.position.x += (camBaseX + parallaxX - camera.position.x) * lerpAlpha;
      camera.position.y += (parallaxY - camera.position.y) * lerpAlpha;
      camera.position.z += (baseZ - camera.position.z) * lerpAlpha;
      cameraLookTarget.set(camBaseX + parallaxX * 0.2, parallaxY * 0.2, 0);
      camera.lookAt(cameraLookTarget);

      const activeHighlightRecord = hoveredPlane ?? focusedFromList;
      const depthSpan = THREE.MathUtils.lerp(activeBounds.depth, RIBBON_BOUNDS.depth, unfoldProgress);
      const fadeStart = baseZ - depthSpan * 0.45;
      const fadeEnd = baseZ + depthSpan * 1.35;

      let bestFrontRecord: PlaneRecord | null = null;
      let bestFrontScore = -Infinity;

      for (let i = 0; i < planes.length; i++) {
        const record = planes[i];
        const target = record.targets[activeMode];

        spatialPos.copy(target.position).multiplyScalar(SHAPE_SIZE);
        if (!reducedMotion) {
          const floatAmt = (1 - unfoldProgress) * 0.045 * FORMATION_SCALE * SHAPE_SIZE;
          spatialPos.x += Math.sin(elapsed * 0.52 + i) * floatAmt;
          spatialPos.y += Math.sin(elapsed * 0.61 + i * 1.13) * floatAmt;
          spatialPos.z += Math.sin(elapsed * 0.7 + i * 0.87) * floatAmt;
        }
        spatialPos.applyQuaternion(groupQuat);
        spatialQuat.copy(target.quaternion).premultiply(groupQuat);

        ribbonPos.copy(record.horizontalTarget.position).multiplyScalar(SHAPE_SIZE);
        targetPos.lerpVectors(spatialPos, ribbonPos, unfoldProgress);
        targetQuat.slerpQuaternions(spatialQuat, record.horizontalTarget.quaternion, unfoldProgress);

        const isHighlighted = record === activeHighlightRecord;
        const highlightLerp = reducedMotion ? 1 : 1 - Math.exp(-dtMs * 0.014);
        record.highlight += ((isHighlighted ? 1 : 0) - record.highlight) * highlightLerp;

        if (record.highlight > 0.001) {
          forwardOffset.set(0, 0, record.highlight * 0.78 * SHAPE_SIZE).applyQuaternion(targetQuat);
          targetPos.add(forwardOffset);
          if (!reducedMotion) {
            hoverEuler.set(
              -hoveredLocalY * 0.14 * record.highlight,
              hoveredLocalX * 0.16 * record.highlight,
              0,
            );
            hoverTiltQuat.setFromEuler(hoverEuler);
            targetQuat.multiply(hoverTiltQuat);
          }
        }

        record.mesh.position.lerp(targetPos, lerpAlpha);
        record.mesh.quaternion.slerp(targetQuat, lerpAlpha);

        const distToCamX = Math.abs(record.mesh.position.x - camBaseX);
        const centerFocus = unfoldProgress > 0.35
          ? clamp(1 - distToCamX / effectiveSpread, 0, 1) * unfoldProgress
          : 0;
        const baseScale = THREE.MathUtils.lerp(target.scale, record.horizontalTarget.scale, unfoldProgress);
        const targetScale = (baseScale + centerFocus * 0.34 + record.highlight * 0.2) * SHAPE_SIZE;
        scaleVec.set(targetScale, targetScale, targetScale);
        record.mesh.scale.lerp(scaleVec, lerpAlpha);

        const dist = camera.position.distanceTo(record.mesh.position);
        let opacity = 1 - (dist - fadeStart) / Math.max(0.01, fadeEnd - fadeStart);
        opacity = clamp(opacity, 0.08, 1);
        opacity = THREE.MathUtils.lerp(opacity, 0.88 + centerFocus * 0.12, unfoldProgress);
        if (activeHighlightRecord && !isHighlighted) {
          opacity *= 1 - activeHighlightRecord.highlight * 0.24;
        }
        record.opacity = opacity;

        const visualHighlight = Math.max(record.highlight, centerFocus * 0.92);
        const uniforms = record.mesh.material.uniforms;
        uniforms.uHighlight.value = visualHighlight;
        uniforms.uOpacity.value = record.opacity;
        record.mesh.renderOrder = isHighlighted
          ? 1000
          : Math.round((opacity + centerFocus) * 100);

        const frontScore = unfoldProgress > 0.5
          ? -distToCamX
          : record.mesh.position.z - Math.abs(record.mesh.position.x) * 0.35;
        if (frontScore > bestFrontScore) {
          bestFrontScore = frontScore;
          bestFrontRecord = record;
        }
      }

      if (bestFrontRecord && bestFrontRecord.slug !== lastReportedFront) {
        lastReportedFront = bestFrontRecord.slug;
        setFrontSlug(bestFrontRecord.slug);
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderFrame);
    };

    const startLoop = () => {
      if (frameId || disposed || !inView || !tabVisible) return;
      lastTime = performance.now();
      frameId = requestAnimationFrame(renderFrame);
    };

    const stopLoop = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) startLoop();
      else stopLoop();
    });
    intersectionObserver.observe(container);

    const onVisibilityChange = () => {
      tabVisible = document.visibilityState !== "hidden";
      if (tabVisible) startLoop();
      else stopLoop();
    };

    const onMotionChange = () => {
      reducedMotion = reducedMotionQuery.matches;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerenter", onPointerEnter);
    dom.addEventListener("pointerleave", onPointerLeave);
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerRelease);
    dom.addEventListener("pointercancel", onPointerRelease);
    dom.addEventListener("lostpointercapture", onPointerRelease);
    dom.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotionQuery.addEventListener("change", onMotionChange);

    resize();
    startLoop();

    return () => {
      disposed = true;
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      dom.removeEventListener("pointerenter", onPointerEnter);
      dom.removeEventListener("pointerleave", onPointerLeave);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerRelease);
      dom.removeEventListener("pointercancel", onPointerRelease);
      dom.removeEventListener("lostpointercapture", onPointerRelease);
      dom.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery.removeEventListener("change", onMotionChange);
      resetViewRef.current = () => {};
      activeLoaders.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
      planes.forEach((record) => {
        sceneGroup.remove(record.mesh);
        record.mesh.geometry.dispose();
        record.mesh.material.dispose();
        record.currentTexture.dispose();
      });
      renderer.dispose();
      dom.remove();
    };
  }, [entries]);

  const handleModeClick = (nextMode: SpaceMode) => {
    setMode(nextMode);
    resetViewRef.current();
  };

  const displaySlug = canvasHoverSlug ?? previewSlug ?? frontSlug;
  const activeEntry = entries.find((entry) => entry.journal.slug === displaySlug) ?? entries[0];

  return (
    <div
      ref={containerRef}
      className="journal-space"
      aria-label="Journals 空间画廊"
    >
      <div className="journal-space__masthead" aria-hidden="true">
        <span className="journal-space__heading">Journals</span>
      </div>
      <div ref={canvasHostRef} className="journal-space__viewport" />
      <div className="journal-space__footer">
        {activeEntry ? (
          <div className="journal-space__caption" aria-live="polite" aria-atomic="true">
            <div className="journal-space__meta">
              <span>
                {String(activeEntry.index + 1).padStart(2, "0")} / {String(entries.length).padStart(2, "0")}
              </span>
              <time dateTime={activeEntry.journal.createdAt}>
                {activeEntry.journal.createdAt.replaceAll("-", ".")}
              </time>
              <span>{activeEntry.placeName}</span>
            </div>
            <h2 className="journal-space__title font-serif">
              <Link to={`/journals/${activeEntry.journal.slug}`}>{activeEntry.journal.title}</Link>
            </h2>
          </div>
        ) : <div />}

        <div className="journal-space__switcher" role="tablist" aria-label="画廊排布方式">
          {SPACE_MODES.map((spaceMode, index) => (
            <Fragment key={spaceMode}>
              <button
                ref={(el) => { modeRefs.current[spaceMode] = el; }}
                type="button"
                role="tab"
                aria-selected={mode === spaceMode}
                className="journal-space__mode"
                onClick={() => handleModeClick(spaceMode)}
              >
                {spaceMode}
              </button>
              {index < SPACE_MODES.length - 1 ? (
                <span className="journal-space__comma" aria-hidden="true">,</span>
              ) : null}
            </Fragment>
          ))}
          <span
            className="journal-space__underline"
            aria-hidden="true"
            style={{
              width: `${underline.width}px`,
              transform: `translateX(${underline.left}px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
