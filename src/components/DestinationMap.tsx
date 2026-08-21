import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./DestinationMap.css";

if (import.meta.env.PROD) {
  maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`);
}

export type DestinationCenter = [number, number];
export type DestinationGeometry = Polygon | MultiPolygon;

/** The map deliberately accepts plain records so it can be used by content loaders and the editor. */
export type Destination = {
  id: string;
  slug: string;
  name: string;
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
const LABEL_ID = "jewelroam-destination-labels";

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

function toFeatureCollection(destinations: Destination[]): FeatureCollection<DestinationGeometry> {
  return {
    type: "FeatureCollection",
    features: destinations.map((destination) => ({
      type: "Feature",
      id: destination.id,
      properties: {
        id: destination.id,
        slug: destination.slug,
        name: destination.name,
        color: destination.color ?? "#b85c45",
      },
      geometry: destination.geometry ?? fallbackGeometry(destination.center),
    })),
  };
}

function styleFor(data: FeatureCollection<DestinationGeometry>): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
        paint: { "raster-opacity": 0.3, "raster-saturation": -0.85, "raster-contrast": -0.12 },
      },
      {
        id: EXTRUSION_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "color"], "#b85c45"],
          "fill-extrusion-height": ["case", ["boolean", ["feature-state", "hover"], false], 9000, 1600],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.88,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#b85c45"],
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.82, 0.6],
        },
      },
      {
        id: OUTLINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#fffdf8", "line-width": 1.5, "line-opacity": 0.94 },
      },
      {
        id: LABEL_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 11, 7, 15],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#20211f", "text-halo-color": "#f5f3ee", "text-halo-width": 1.5 },
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
  for (const destination of destinations) {
    const [lng, lat] = destination.center;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  // Keep a useful initial view for one-place collections as well as many places.
  const paddingLng = Math.max((maxLng - minLng) * 0.8, 5);
  const paddingLat = Math.max((maxLat - minLat) * 0.8, 3);
  return [[minLng - paddingLng, minLat - paddingLat], [maxLng + paddingLng, maxLat + paddingLat]];
}

export function DestinationMap({ destinations, onSelect, className, ariaLabel = "Destinations map" }: DestinationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredIdRef = useRef<string | number | null>(null);
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

    const syncDestinationSource = () => {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) return false;
      source.setData(toFeatureCollection(destinationsRef.current));
      if (map.isStyleLoaded()) {
        const bounds = boundsFor(destinationsRef.current);
        if (bounds) map.fitBounds(bounds, { padding: 36, duration: 0, maxZoom: 7 });
      }
      return true;
    };
    let syncFrame: number | undefined;
    const syncWhenReady = () => {
      if (syncDestinationSource()) return;
      syncFrame = window.requestAnimationFrame(syncWhenReady);
    };

    const setHover = (id: string | number | null) => {
      if (hoveredIdRef.current !== null) map.setFeatureState({ source: SOURCE_ID, id: hoveredIdRef.current }, { hover: false });
      hoveredIdRef.current = id;
      if (id !== null) map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
    };
    const handleMove = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      map.getCanvas().style.cursor = feature ? "pointer" : "";
      setHover(feature?.id ?? null);
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
      setHover(null);
    };
    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const id = event.features?.[0]?.id;
      if (id === undefined || id === null) return;
      const destination = destinationsRef.current.find((entry) => entry.id === String(id) || entry.id === id);
      if (destination) onSelectRef.current?.(destination);
    };
    map.on("mousemove", FILL_ID, handleMove);
    map.on("mouseleave", FILL_ID, handleLeave);
    map.on("click", FILL_ID, handleClick);
    map.once("load", syncDestinationSource);
    syncWhenReady();
    return () => {
      if (syncFrame !== undefined) window.cancelAnimationFrame(syncFrame);
      resizeObserver.disconnect();
      setHover(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(data);
    if (map.isStyleLoaded()) {
      const bounds = boundsFor(destinations);
      if (bounds) map.fitBounds(bounds, { padding: 36, duration: 500, maxZoom: 7 });
    }
  }, [data, destinations]);

  return <div ref={containerRef} className={`destination-map ${className ?? ""}`} role="application" aria-label={ariaLabel} />;
}
