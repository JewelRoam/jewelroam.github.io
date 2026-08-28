import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type { FeatureCollection, LineString, MultiPolygon, Polygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./DestinationMap.css";

if (import.meta.env.PROD) {
  maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`);
}

type DestinationCenter = [number, number];
export type DestinationGeometry = LineString | Polygon | MultiPolygon;

/** The map deliberately accepts plain records so it can be used by content loaders and the editor. */
export type Destination = {
  id: string;
  slug: string;
  name: string;
  kind?: "area" | "route";
  parentId?: string;
  center: DestinationCenter;
  geometry?: DestinationGeometry;
  color?: string;
};

export type DestinationMapProps = {
  destinations: Destination[];
  onSelect?: (destination: Destination) => void;
  className?: string;
  ariaLabel?: string;
};

const SOURCE_ID = "jewelroam-destinations";
const EXTRUSION_ID = "jewelroam-destination-extrusion";
const FILL_ID = "jewelroam-destination-fill";
const OUTLINE_ID = "jewelroam-destination-outline";
const ROUTE_ID = "jewelroam-destination-route";
const DESTINATION_PALETTE = [
  "#55746d", // sage teal
  "#71816a", // lichen
  "#687985", // blue gray
  "#887568", // muted clay
  "#8a8066", // ochre stone
  "#777b77", // neutral moss
] as const;
const DEFAULT_MAP_COLOR = DESTINATION_PALETTE[0];

/** Keep a place's visual identity stable when the destination list is reordered. */
function colorForDestination(destination: Pick<Destination, "id" | "color">) {
  const explicitColor = destination.color?.trim();
  if (explicitColor) return explicitColor;

  let hash = 2166136261;
  for (let index = 0; index < destination.id.length; index += 1) {
    hash ^= destination.id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return DESTINATION_PALETTE[(hash >>> 0) % DESTINATION_PALETTE.length];
}

/**
 * A small polygon keeps a place visible when a record has only coordinates. Content can
 * provide a more accurate local GeoJSON geometry whenever it is available.
 */
function fallbackGeometry([longitude, latitude]: DestinationCenter): Polygon {
  const width = 0.42;
  const height = 0.25;
  return {
    type: "Polygon",
    coordinates: [[
      [longitude - width, latitude - height],
      [longitude + width, latitude - height],
      [longitude + width, latitude + height],
      [longitude - width, latitude + height],
      [longitude - width, latitude - height],
    ]],
  };
}

function renderDepths(destinations: Destination[]) {
  const byId = new Map(destinations.map((destination) => [destination.id, destination]));
  const cache = new Map<string, number>();

  const depthFor = (id: string, trail = new Set<string>()): number => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    if (trail.has(id)) return 0;
    const parentId = byId.get(id)?.parentId;
    if (!parentId || !byId.has(parentId)) {
      cache.set(id, 0);
      return 0;
    }
    const nextTrail = new Set(trail);
    nextTrail.add(id);
    const depth = depthFor(parentId, nextTrail) + 1;
    cache.set(id, depth);
    return depth;
  };

  return new Map(destinations.map((destination) => [destination.id, depthFor(destination.id)]));
}

function toFeatureCollection(destinations: Destination[]): FeatureCollection<DestinationGeometry> {
  const depths = renderDepths(destinations);
  const ordered = [...destinations].sort((a, b) =>
    (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0) || a.id.localeCompare(b.id),
  );
  return {
    type: "FeatureCollection",
    features: ordered.map((destination) => ({
      type: "Feature",
      id: destination.id,
      properties: {
        id: destination.id,
        slug: destination.slug,
        name: destination.name,
        kind: destination.kind ?? "area",
        parentId: destination.parentId ?? null,
        depth: depths.get(destination.id) ?? 0,
        color: colorForDestination(destination),
      },
      geometry: destination.geometry ?? fallbackGeometry(destination.center),
    })),
  };
}

function styleFor(data: FeatureCollection<DestinationGeometry>): StyleSpecification {
  return {
    version: 8,
    sources: {
      // OSM is only a visual reference layer; destinations remain a local GeoJSON source.
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
      [SOURCE_ID]: { type: "geojson", data, promoteId: "id" },
    },
    layers: [
      { id: "jewelroam-background", type: "background", paint: { "background-color": "#e9e4d9" } },
      {
        id: "jewelroam-osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-opacity": 0.54,
          "raster-saturation": -0.64,
          "raster-contrast": 0.14,
          "raster-brightness-min": 0.66,
          "raster-brightness-max": 0.96,
        },
      },
      {
        id: EXTRUSION_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        filter: ["!=", ["get", "kind"], "route"],
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "color"], DEFAULT_MAP_COLOR],
          "fill-extrusion-height": [
            "case",
            ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]],
            12000,
            3000,
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.84,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        filter: ["!=", ["get", "kind"], "route"],
        paint: {
          "fill-color": ["coalesce", ["get", "color"], DEFAULT_MAP_COLOR],
          "fill-opacity": [
            "case",
            ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]],
            0.92,
            0.72,
          ],
        },
      },
      {
        id: OUTLINE_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["!=", ["get", "kind"], "route"],
        paint: { "line-color": "#fffdf8", "line-width": 1.5, "line-opacity": 0.94 },
      },
      {
        id: ROUTE_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "route"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["coalesce", ["get", "color"], DEFAULT_MAP_COLOR],
          "line-width": [
            "case",
            ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]],
            6,
            3.5,
          ],
          "line-opacity": [
            "case",
            ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]],
            0.96,
            0.72,
          ],
          "line-dasharray": [1.4, 1.2],
        },
      },
    ],
  };
}

function boundsFor(destinations: Destination[]): [[number, number], [number, number]] | null {
  if (!destinations.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const points: DestinationCenter[] = [];
  const collectCoordinates = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(collectCoordinates);
  };
  for (const destination of destinations) {
    const [lng, lat] = destination.center;
    points.push([lng, lat]);
    collectCoordinates(destination.geometry?.coordinates);
  }
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

function topFeature(features: maplibregl.MapGeoJSONFeature[] | undefined) {
  return [...(features ?? [])].sort((a, b) =>
    Number(b.properties?.depth ?? 0) - Number(a.properties?.depth ?? 0) ||
    String(a.properties?.id ?? a.id).localeCompare(String(b.properties?.id ?? b.id)),
  )[0];
}

export function DestinationMap({ destinations, onSelect, className, ariaLabel = "Destinations map" }: DestinationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredIdRef = useRef<string | number | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const mapHoveredIdRef = useRef<string | null>(null);
  const markerRefs = useRef(new Map<string, maplibregl.Marker>());
  const markerElementsRef = useRef(new Map<string, HTMLButtonElement>());
  const markerInteractionRef = useRef(new Map<string, { hovered: boolean; focused: boolean }>());
  const syncMarkersRef = useRef<(() => void) | null>(null);
  const destinationsRef = useRef(destinations);
  const onSelectRef = useRef(onSelect);
  destinationsRef.current = destinations;
  onSelectRef.current = onSelect;

  const data = useMemo(() => toFeatureCollection(destinations), [destinations]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const initialBounds = boundsFor(destinationsRef.current);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleFor(toFeatureCollection(destinationsRef.current)),
      center: [110, 30],
      zoom: 2.8,
      bounds: initialBounds ?? undefined,
      fitBoundsOptions: initialBounds
        ? { padding: 36, maxZoom: 7 }
        : undefined,
      pitch: 42,
      bearing: -12,
      minZoom: 1.2,
      maxZoom: 11,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      // A single finger should pan on touch devices. Pinch remains available for zooming.
      cooperativeGestures: false,
      touchPitch: false,
    });
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    const normalizedId = (id: string | number | null | undefined) =>
      id === null || id === undefined ? null : String(id);

    const setFeatureHover = (id: string | null) => {
      const previousId = hoveredIdRef.current === null ? null : String(hoveredIdRef.current);
      const sourceReady = map.isStyleLoaded() && map.getSource(SOURCE_ID);
      if (sourceReady && previousId !== null && previousId !== id) {
        map.setFeatureState({ source: SOURCE_ID, id: previousId }, { hover: false });
      }
      hoveredIdRef.current = id;
      if (sourceReady && id !== null) {
        map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
      }
    };

    const setFeatureSelected = (id: string | null) => {
      const previousId = selectedIdRef.current;
      const sourceReady = map.isStyleLoaded() && map.getSource(SOURCE_ID);
      if (sourceReady && previousId !== null && previousId !== id) {
        map.setFeatureState({ source: SOURCE_ID, id: previousId }, { selected: false });
      }
      selectedIdRef.current = id;
      if (sourceReady && id !== null) {
        map.setFeatureState({ source: SOURCE_ID, id }, { selected: true });
      }
    };

      const syncInteraction = () => {
      let activeId: string | null = null;
      for (const [id, state] of markerInteractionRef.current) {
        if (state.focused) {
          activeId = id;
          break;
        }
      }
      if (activeId === null) {
        for (const [id, state] of markerInteractionRef.current) {
          if (state.hovered) {
            activeId = id;
            break;
          }
        }
      }
      activeId ??= mapHoveredIdRef.current;
      setFeatureHover(activeId);
      for (const [id, element] of markerElementsRef.current) {
        element.classList.toggle("is-active", id === activeId);
        element.classList.toggle("is-selected", id === selectedIdRef.current);
        const marker = markerRefs.current.get(id);
        const root = marker?.getElement();
        root?.classList.toggle("is-active", id === activeId);
        root?.classList.toggle("is-selected", id === selectedIdRef.current);
      }
    };

    const setMarkerInteraction = (
      id: string,
      property: "hovered" | "focused",
      value: boolean,
    ) => {
      const state = markerInteractionRef.current.get(id) ?? { hovered: false, focused: false };
      state[property] = value;
      markerInteractionRef.current.set(id, state);
      syncInteraction();
      scheduleMarkerLayout();
    };

    const activateDestination = (id: string) => {
      const destination = destinationsRef.current.find((entry) => entry.id === id);
      if (!destination) return;
      setFeatureSelected(id);
      syncInteraction();
      onSelectRef.current?.(destination);
    };

    const layoutMarkers = (pass = 0): void => {
      const mapRect = map.getContainer().getBoundingClientRect();
      if (!mapRect.width || !mapRect.height) return;

      const activeIds = new Set<string>();
      for (const [id, state] of markerInteractionRef.current) {
        if (state.focused || state.hovered) activeIds.add(id);
      }
      if (mapHoveredIdRef.current) activeIds.add(mapHoveredIdRef.current);
      if (selectedIdRef.current) activeIds.add(selectedIdRef.current);

      const ordered = [...destinationsRef.current].sort((a, b) => {
        const activeDelta = Number(activeIds.has(b.id)) - Number(activeIds.has(a.id));
        if (activeDelta) return activeDelta;
        const kindDelta = Number(a.kind === "route") - Number(b.kind === "route");
        return kindDelta || a.id.localeCompare(b.id);
      });
      const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = [];
      const candidates: Array<[number, number]> = [
        [0, -30], [0, 30], [58, 0], [-58, 0],
        [48, -28], [-48, -28], [48, 28], [-48, 28],
        [0, -58], [0, 58], [86, 0], [-86, 0], [0, 0],
      ];
      type MarkerRect = { left: number; top: number; right: number; bottom: number };
      const rectFor = (point: maplibregl.Point, width: number, height: number, offset: [number, number]): MarkerRect => ({
        left: point.x + offset[0] - width / 2,
        top: point.y + offset[1] - height / 2,
        right: point.x + offset[0] + width / 2,
        bottom: point.y + offset[1] + height / 2,
      });
      const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) =>
        a.left < b.right + 6 && a.right + 6 > b.left && a.top < b.bottom + 6 && a.bottom + 6 > b.top;
      const overlapArea = (a: MarkerRect, b: MarkerRect) => {
        const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return width * height;
      };
      const clampToRange = (value: number, min: number, max: number) =>
        min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value));
      const clampedOffset = (point: maplibregl.Point, width: number, height: number): [number, number] => [
        clampToRange(0, 6 + width / 2 - point.x, mapRect.width - 6 - width / 2 - point.x),
        clampToRange(0, 6 + height / 2 - point.y, mapRect.height - 6 - height / 2 - point.y),
      ];

      // Restore every label before measuring. A passive marker may have been collapsed
      // by the previous pass; measuring its dot would otherwise make a colliding label
      // look available and let it expand again without a second real width check.
      let layoutChanged = false;
      for (const [id, button] of markerElementsRef.current) {
        if (button.classList.contains("is-collapsed")) {
          button.classList.remove("is-collapsed");
          layoutChanged = true;
        }
      }

      for (const destination of ordered) {
        const marker = markerRefs.current.get(destination.id);
        const button = markerElementsRef.current.get(destination.id);
        if (!marker || !button) continue;
        const point = map.project(destination.center);
        const bounds = button.getBoundingClientRect();
        const width = bounds.width || 120;
        const height = bounds.height || 30;
        const active = activeIds.has(destination.id);
        let selected: [number, number] | null = null;
        let selectedRect: MarkerRect | null = null;
        let leastOverlapping: { offset: [number, number]; rect: MarkerRect; area: number } | null = null;

        for (const offset of candidates) {
          const rect = rectFor(point, width, height, offset);
          const inside = rect.left >= 6 && rect.right <= mapRect.width - 6 && rect.top >= 6 && rect.bottom <= mapRect.height - 6;
          if (!inside) continue;
          const collision = occupied.some((item) => overlaps(rect, item));
          if (!collision) {
            selected = offset;
            selectedRect = rect;
            break;
          }
          const area = occupied.reduce((total, item) => total + overlapArea(rect, item), 0);
          if (!leastOverlapping || area < leastOverlapping.area) {
            leastOverlapping = { offset, rect, area };
          }
        }

        // Keep the focused/hovered marker readable even when every candidate touches
        // another marker. It takes the least-overlapping position; passive markers may
        // collapse to a dot instead.
        if (!selected && active && leastOverlapping) {
          selected = leastOverlapping.offset;
          selectedRect = leastOverlapping.rect;
        }

        if (!selected && !active) {
          const dot = 20;
          const dotCandidates = [
            ...candidates,
            [0, -86], [0, 86], [112, 0], [-112, 0],
            [86, -58], [-86, -58], [86, 58], [-86, 58],
          ] as Array<[number, number]>;
          const dotPlacements = dotCandidates
            .map((offset) => ({
              offset,
              rect: rectFor(point, dot, dot, offset),
              area: occupied.reduce((total, item) => total + overlapArea(rectFor(point, dot, dot, offset), item), 0),
            }))
            .filter(({ rect }) =>
              rect.left >= 6 &&
              rect.right <= mapRect.width - 6 &&
              rect.top >= 6 &&
              rect.bottom <= mapRect.height - 6,
            );
          const dotPlacement = dotPlacements.find(({ rect }) =>
            !occupied.some((item) => overlaps(rect, item)),
          ) ?? dotPlacements.sort((a, b) => a.area - b.area)[0];
          selected = dotPlacement?.offset ?? clampedOffset(point, dot, dot);
          selectedRect = dotPlacement?.rect ?? rectFor(point, dot, dot, selected);
          if (!button.classList.contains("is-collapsed")) layoutChanged = true;
          button.classList.add("is-collapsed");
        } else {
          if (button.classList.contains("is-collapsed")) layoutChanged = true;
          button.classList.remove("is-collapsed");
          if (!selected) {
            selected = clampedOffset(point, width, height);
            selectedRect = rectFor(point, width, height, selected);
          }
        }

        marker.setOffset(selected);
        if (selectedRect) occupied.push(selectedRect);
      }

      // classList changes affect the measured label width. A bounded synchronous second
      // pass makes the newly expanded/collapsed geometry participate in collision checks
      // without creating a perpetual animation-frame loop.
      if (layoutChanged && pass < 2) layoutMarkers(pass + 1);
    };

    let markerLayoutFrame: number | null = null;
    const scheduleMarkerLayout = () => {
      if (markerLayoutFrame !== null) return;
      markerLayoutFrame = window.requestAnimationFrame(() => {
        markerLayoutFrame = null;
        layoutMarkers();
      });
    };

    const syncMarkers = () => {
      const currentDestinations = new Map(
        destinationsRef.current.map((destination) => [destination.id, destination]),
      );

      for (const [id, marker] of markerRefs.current) {
        if (currentDestinations.has(id)) continue;
        marker.remove();
        markerRefs.current.delete(id);
        markerElementsRef.current.delete(id);
        markerInteractionRef.current.delete(id);
      }

      for (const destination of currentDestinations.values()) {
        const id = destination.id;
        const color = colorForDestination(destination);
        const existingMarker = markerRefs.current.get(id);
        const existingButton = markerElementsRef.current.get(id);
        if (existingMarker && existingButton) {
          existingMarker.setLngLat(destination.center);
          existingMarker.getElement().style.setProperty("--destination-color", color);
          existingButton.querySelector(".destination-map__marker-label")!.textContent = destination.name;
          existingButton.setAttribute(
            "aria-label",
            `${destination.kind === "route" ? "查看路线" : "查看目的地"}：${destination.name}`,
          );
          existingButton.classList.toggle("destination-map__marker--route", destination.kind === "route");
          continue;
        }

        const markerRoot = document.createElement("div");
        markerRoot.className = "destination-map__marker-root";
        markerRoot.style.setProperty("--destination-color", color);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `destination-map__marker${destination.kind === "route" ? " destination-map__marker--route" : ""}`;
        button.setAttribute(
          "aria-label",
          `${destination.kind === "route" ? "查看路线" : "查看目的地"}：${destination.name}`,
        );
        button.title = destination.name;
        const label = document.createElement("span");
        label.className = "destination-map__marker-label";
        label.textContent = destination.name;
        button.append(label);
        markerRoot.append(button);

        button.addEventListener("mouseenter", () => setMarkerInteraction(id, "hovered", true));
        button.addEventListener("mouseleave", () => setMarkerInteraction(id, "hovered", false));
        button.addEventListener("focus", () => setMarkerInteraction(id, "focused", true));
        button.addEventListener("blur", () => setMarkerInteraction(id, "focused", false));
        button.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activateDestination(id);
        });
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          activateDestination(id);
        });

        const marker = new maplibregl.Marker({ element: markerRoot, anchor: "center" })
          .setLngLat(destination.center)
          .addTo(map);
        markerRefs.current.set(id, marker);
        markerElementsRef.current.set(id, button);
        markerInteractionRef.current.set(id, { hovered: false, focused: false });
      }
      if (mapHoveredIdRef.current && !currentDestinations.has(mapHoveredIdRef.current)) {
        mapHoveredIdRef.current = null;
      }
      if (selectedIdRef.current && !currentDestinations.has(selectedIdRef.current)) {
        setFeatureSelected(null);
      }
      syncInteraction();
      scheduleMarkerLayout();
    };
    syncMarkersRef.current = syncMarkers;

    const syncDestinationSource = () => {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) return false;
      source.setData(toFeatureCollection(destinationsRef.current));
      // Markers are DOM elements and can be mounted as soon as the source exists;
      // waiting for the style-loaded event leaves them missing on a cold load.
      syncMarkers();
      if (map.isStyleLoaded()) {
        const bounds = boundsFor(destinationsRef.current);
        if (bounds) map.fitBounds(bounds, { padding: 36, duration: 0, maxZoom: 7 });
      }
      return true;
    };
    let syncFrame: number | undefined;
    let syncAttempts = 0;
    const maxSyncAttempts = 120;
    const syncWhenReady = () => {
      if (syncDestinationSource()) return;
      if (syncAttempts >= maxSyncAttempts) return;
      syncAttempts += 1;
      syncFrame = window.requestAnimationFrame(syncWhenReady);
    };
    const handleMove = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = topFeature(event.features);
      map.getCanvas().style.cursor = feature ? "pointer" : "";
      mapHoveredIdRef.current = normalizedId(feature?.id);
      syncInteraction();
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
      mapHoveredIdRef.current = null;
      syncInteraction();
    };
    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = topFeature(event.features);
      const id = normalizedId(feature?.id);
      if (id !== null) activateDestination(id);
    };
    map.on("mousemove", [FILL_ID, ROUTE_ID], handleMove);
    map.on("mouseleave", [FILL_ID, ROUTE_ID], handleLeave);
    map.on("click", [FILL_ID, ROUTE_ID], handleClick);
    map.on("move", scheduleMarkerLayout);
    map.on("zoom", scheduleMarkerLayout);
    map.on("resize", scheduleMarkerLayout);
    map.once("load", () => {
      syncDestinationSource();
      syncMarkers();
    });
    syncWhenReady();
    return () => {
      if (syncFrame !== undefined) window.cancelAnimationFrame(syncFrame);
      if (markerLayoutFrame !== null) window.cancelAnimationFrame(markerLayoutFrame);
      resizeObserver.disconnect();
      map.off("move", scheduleMarkerLayout);
      map.off("zoom", scheduleMarkerLayout);
      map.off("resize", scheduleMarkerLayout);
      setFeatureHover(null);
      setFeatureSelected(null);
      syncMarkersRef.current = null;
      for (const marker of markerRefs.current.values()) marker.remove();
      markerRefs.current.clear();
      markerElementsRef.current.clear();
      markerInteractionRef.current.clear();
      mapHoveredIdRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(data);
    syncMarkersRef.current?.();
    if (map.isStyleLoaded()) {
      const bounds = boundsFor(destinations);
      if (bounds) map.fitBounds(bounds, { padding: 36, duration: 500, maxZoom: 7 });
    }
  }, [data, destinations]);

  return <div ref={containerRef} className={`destination-map ${className ?? ""}`} role="region" aria-label={ariaLabel} />;
}
