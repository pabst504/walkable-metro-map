"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  Marker,
  CircleMarker,
  Polyline,
  useMap,
  useMapEvents
} from "react-leaflet";
import { DivIcon } from "leaflet";
import type { PathOptions } from "leaflet";
import type { NearestStationResult } from "@/lib/nearest-station";
import type { MetroStation } from "@/lib/wmata-stations";
import type { VreStation } from "@/lib/vre-stations";
import type { MarcStation } from "@/lib/marc-stations";

type IsochroneCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

type SelectableStation = { id: string; lat: number; lng: number };

type MetroMapProps = {
  stations: MetroStation[];
  selectedStations: SelectableStation[];
  activeMinutes: number[];
  focusedStationId: string | null;
  theme: "light" | "dark";
  nearestStationResult: NearestStationResult | null;
  onClearNearestStation: () => void;
  onIsochroneLoadingChange: (stationIds: string[]) => void;
  onToggleStation: (id: string, options?: { focusMap?: boolean }) => void;
  vreStations: VreStation[];
  marcStations: MarcStation[];
  visibleTransit: { metro: boolean; marc: boolean; vre: boolean };
};

const LINE_COLORS: Record<string, string> = {
  Red: "#d73b3e",
  Orange: "#da8707",
  Blue: "#0d63ae",
  Silver: "#90a4ae",
  Yellow: "#f0c808",
  Green: "#009b4d"
};

const ISOCHRONE_COLORS: Record<number, string> = {
  5: "#1f7a8c",
  10: "#5c9d62",
  15: "#bf4342"
};

const DEFAULT_MAP_CENTER: [number, number] = [38.9072, -77.0369];
const DEFAULT_MAP_ZOOM = 11;
const SELECTED_STATION_LABEL_MIN_ZOOM = 12;
const ALL_STATION_LABEL_MIN_ZOOM = 14;
const STREET_LABEL_MIN_ZOOM = 13;

export function MetroMap({
  stations,
  selectedStations,
  activeMinutes,
  focusedStationId,
  theme,
  nearestStationResult,
  onClearNearestStation,
  onIsochroneLoadingChange,
  onToggleStation,
  vreStations,
  marcStations,
  visibleTransit
}: MetroMapProps) {
  // Build lookups: metroStationId → station for co-located stations
  const vreByMetroId = Object.fromEntries(
    vreStations.filter((v) => v.metroStationId).map((v) => [v.metroStationId!, v])
  );
  const marcByMetroId = Object.fromEntries(
    marcStations.filter((m) => m.metroStationId).map((m) => [m.metroStationId!, m])
  );
  // Standalone stations (no Metro overlap)
  const standaloneVreStations = vreStations.filter((v) => !v.metroStationId);
  const standaloneMarcStations = marcStations.filter((m) => !m.metroStationId);
  const [isochronesByStation, setIsochronesByStation] = useState<Record<string, IsochroneCollection>>({});
  const [loadingStationIds, setLoadingStationIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0);
  const [dismissedRouteIds, setDismissedRouteIds] = useState<Set<string>>(new Set());
  const focusedStation = stations.find((station) => station.id === focusedStationId) ?? null;
  const baseMapVariant = theme === "dark" ? "dark_nolabels" : "light_nolabels";
  const labelMapVariant = theme === "dark" ? "dark_only_labels" : "light_only_labels";

  useEffect(() => {
    if (nearestStationResult) {
      setDismissedRouteIds(new Set());
    }
  }, [nearestStationResult]);

  useEffect(() => {
    onIsochroneLoadingChange(loadingStationIds);
  }, [loadingStationIds, onIsochroneLoadingChange]);

  useEffect(() => {
    let cancelled = false;

    async function loadIsochrones() {
      const requestsByStation = selectedStations
        .map((station) => {
          const currentCollection = isochronesByStation[station.id];
          const loadedMinutes = new Set(
            (currentCollection?.features ?? []).map((feature) => Number(feature.properties?.minutes))
          );
          const missingMinutes = activeMinutes.filter((minutes) => !loadedMinutes.has(minutes));

          return missingMinutes.length > 0 ? { station, missingMinutes } : null;
        })
        .filter((value): value is { station: SelectableStation; missingMinutes: number[] } => value !== null);

      const requestedStationIds = requestsByStation.map(({ station }) => station.id);

      if (requestsByStation.length === 0) {
        setLoadingStationIds([]);
        return;
      }

      setLoadingStationIds((current) => [...new Set([...current, ...requestedStationIds])]);

      try {
        const requests = await Promise.all(
          requestsByStation.map(async ({ station, missingMinutes }) => {
            const params = new URLSearchParams({
              lat: String(station.lat),
              lng: String(station.lng),
              minutes: missingMinutes.join(",")
            });
            const response = await fetch(`/api/isochrones?${params.toString()}`, {
              cache: "no-store"
            });
            const data = (await response.json()) as IsochroneCollection;
            return [station.id, data] as const;
          })
        );

        if (!cancelled) {
          setIsochronesByStation((current) => {
            const next = { ...current };

            for (const [stationId, data] of requests) {
              const existingFeatures = next[stationId]?.features ?? [];
              const mergedFeatures = [...existingFeatures];
              const seenMinutes = new Set(
                existingFeatures.map((feature) => Number(feature.properties?.minutes))
              );

              for (const feature of data.features ?? []) {
                const minutes = Number(feature.properties?.minutes);

                if (!seenMinutes.has(minutes)) {
                  mergedFeatures.push(feature);
                }
              }

              next[stationId] = {
                type: "FeatureCollection",
                features: mergedFeatures
              };
            }

            return next;
          });
          setLoadingStationIds((current) =>
            current.filter((stationId) => !requestedStationIds.includes(stationId))
          );
        }
      } catch {
        if (!cancelled) {
          setLoadingStationIds((current) =>
            current.filter((stationId) => !requestedStationIds.includes(stationId))
          );
        }
      }
    }

    void loadIsochrones();

    return () => {
      cancelled = true;
    };
  }, [activeMinutes, isochronesByStation, selectedStations]);

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      className="mapCanvas"
      scrollWheelZoom
      zoomControl={false}
      markerZoomAnimation={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/${baseMapVariant}/{z}/{x}/{y}{r}.png`}
        subdomains={["a", "b", "c", "d"]}
      />
      {zoom >= STREET_LABEL_MIN_ZOOM ? (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={`https://{s}.basemaps.cartocdn.com/${labelMapVariant}/{z}/{x}/{y}{r}.png`}
          subdomains={["a", "b", "c", "d"]}
          pane="overlayPane"
        />
      ) : null}

      <MapZoomTracker onZoomChange={setZoom} />
      <ZoomControls />
      <MapViewController station={focusedStation} nearestStationResult={nearestStationResult} />

      {nearestStationResult ? (
        <>
          {/* Route line + info overlay for every station within 15 min */}
          {nearestStationResult.stations
            .filter((walk) => !dismissedRouteIds.has(walk.station.id))
            .map((walk, index) => (
            <Fragment key={walk.station.id}>
              <Polyline
                positions={walk.route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
                pathOptions={{
                  color: theme === "dark" ? "#8fd5e1" : "#1f7a8c",
                  weight: index === 0 ? 4 : 3,
                  opacity: index === 0 ? 0.85 : 0.55,
                  dashArray: index === 0 ? undefined : "6 4"
                }}
              />
              <Marker
                position={[walk.station.lat, walk.station.lng]}
                icon={createNearestStationOverlayIcon(
                  walk.station.name,
                  walk.station.lines.join(" / "),
                  Math.max(1, Math.round(walk.walkingDurationSeconds / 60)),
                  (walk.walkingDistanceMeters / 1609.344).toFixed(1),
                  zoom < 13,
                  zoom < 11
                )}
                eventHandlers={{
                  click: () => {
                    const stationId = walk.station.id;
                    const newDismissed = new Set(dismissedRouteIds).add(stationId);
                    setDismissedRouteIds(newDismissed);
                    onToggleStation(stationId);
                    if (newDismissed.size === nearestStationResult.stations.length) {
                      onClearNearestStation();
                    }
                  }
                }}
              />
            </Fragment>
          ))}
          {/* Address pin */}
          <CircleMarker
            center={[nearestStationResult.address.lat, nearestStationResult.address.lng]}
            radius={7}
            pathOptions={{
              color: theme === "dark" ? "#10161d" : "#ffffff",
              weight: 2,
              fillColor: theme === "dark" ? "#8fd5e1" : "#1f7a8c",
              fillOpacity: 1
            }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <strong>{nearestStationResult.matchedAddress}</strong>
              <br />
              Start point
            </Tooltip>
          </CircleMarker>
        </>
      ) : null}

      {selectedStations.map((station) => {
        const collection = isochronesByStation[station.id];

        if (!collection) {
          return null;
        }

        return collection.features
          .filter((feature) => {
            const minutes = Number(feature.properties?.minutes);
            return activeMinutes.includes(minutes);
          })
            .map((feature) => {
              const minutes = Number(feature.properties?.minutes);
              const style: PathOptions = {
                color: getIsochroneColor(minutes),
                weight: 2,
                fillOpacity: minutes <= 5 ? 0.18 : minutes <= 10 ? 0.14 : 0.1,
                opacity: 0.9
              };

            return (
              <GeoJSON
                key={`${station.id}-${minutes}`}
                data={feature}
                style={() => style}
              />
            );
          });
      })}

      {stations.map((station) => {
        const vreOverlap = visibleTransit.vre ? vreByMetroId[station.id] : undefined;
        const marcOverlap = visibleTransit.marc ? marcByMetroId[station.id] : undefined;
        // Skip if Metro hidden and no visible co-located transit at this station
        if (!visibleTransit.metro && !marcOverlap && !vreOverlap) return null;
        const isSelected = selectedStations.some((selected) => selected.id === station.id);
        const shouldShowLabel =
          zoom >= ALL_STATION_LABEL_MIN_ZOOM || (isSelected && zoom >= SELECTED_STATION_LABEL_MIN_ZOOM);

        // When Metro is hidden, use the standalone shape of the single visible transit type
        const stationIcon = !visibleTransit.metro && vreOverlap && !marcOverlap
          ? createVreStandaloneIcon(isSelected)
          : !visibleTransit.metro && marcOverlap && !vreOverlap
            ? createMarcStandaloneIcon(isSelected)
            : createStationIcon(station, isSelected, marcOverlap, vreOverlap, visibleTransit.metro);

        return (
          <Fragment key={station.id}>
            <Marker
              position={[station.lat, station.lng]}
              icon={stationIcon}
              eventHandlers={{
                click: () => onToggleStation(station.id, { focusMap: false })
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <strong>{station.name}</strong>
                <br />
                {station.lines.join(" / ")}
                {marcOverlap ? ` · MARC ${marcOverlap.lines.join(" / ")}` : ""}
                {vreOverlap ? ` · VRE ${vreOverlap.lines.join(" / ")}` : ""}
              </Tooltip>
            </Marker>
            {shouldShowLabel ? (
              <Marker
                position={[station.lat, station.lng]}
                icon={createStationLabelIcon(station.name, isSelected)}
                interactive={false}
              />
            ) : null}
          </Fragment>
        );
      })}

      {/* Standalone MARC stations (no Metro overlap) */}
      {visibleTransit.marc && standaloneMarcStations.map((marc) => {
        const isMarcSelected = selectedStations.some((s) => s.id === marc.id);
        const shouldShowLabel =
          zoom >= ALL_STATION_LABEL_MIN_ZOOM || (isMarcSelected && zoom >= SELECTED_STATION_LABEL_MIN_ZOOM);
        return (
          <Fragment key={marc.id}>
            <Marker
              position={[marc.lat, marc.lng]}
              icon={createMarcStandaloneIcon(isMarcSelected)}
              eventHandlers={{
                click: () => onToggleStation(marc.id, { focusMap: false })
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <strong>{marc.name}</strong>
                <br />
                MARC {marc.lines.join(" / ")}
              </Tooltip>
            </Marker>
            {shouldShowLabel ? (
              <Marker
                position={[marc.lat, marc.lng]}
                icon={createStationLabelIcon(marc.name, isMarcSelected)}
                interactive={false}
              />
            ) : null}
          </Fragment>
        );
      })}

      {/* Standalone VRE stations (no Metro overlap) */}
      {visibleTransit.vre && standaloneVreStations.map((vre) => {
        const isVreSelected = selectedStations.some((s) => s.id === vre.id);
        const shouldShowLabel =
          zoom >= ALL_STATION_LABEL_MIN_ZOOM || (isVreSelected && zoom >= SELECTED_STATION_LABEL_MIN_ZOOM);
        return (
          <Fragment key={vre.id}>
            <Marker
              position={[vre.lat, vre.lng]}
              icon={createVreStandaloneIcon(isVreSelected)}
              eventHandlers={{
                click: () => onToggleStation(vre.id, { focusMap: false })
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <strong>{vre.name}</strong>
                <br />
                VRE {vre.lines.join(" / ")}
              </Tooltip>
            </Marker>
            {shouldShowLabel ? (
              <Marker
                position={[vre.lat, vre.lng]}
                icon={createStationLabelIcon(vre.name, isVreSelected)}
                interactive={false}
              />
            ) : null}
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

type MapViewControllerProps = {
  station: MetroStation | null;
  nearestStationResult: NearestStationResult | null;
};

function MapViewController({ station, nearestStationResult }: MapViewControllerProps) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const previousNearestResult = useRef<NearestStationResult | null>(null);
  const previousStationId = useRef<string | null>(null);

  useLayoutEffect(() => {
    const container = map.getContainer();
    const syncMapSize = () => {
      map.invalidateSize();
    };

    const frameId = window.requestAnimationFrame(() => {
      syncMapSize();
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, {
        animate: false
      });
      hasInitialized.current = true;
    });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            syncMapSize();
          });

    resizeObserver?.observe(container);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (!hasInitialized.current) {
      return;
    }

    if (nearestStationResult) {
      const allPoints: [number, number][] = [
        [nearestStationResult.address.lat, nearestStationResult.address.lng],
        ...nearestStationResult.stations.map((s) => [s.station.lat, s.station.lng] as [number, number])
      ];
      map.fitBounds(allPoints, { padding: [80, 80] });
      previousNearestResult.current = nearestStationResult;
      previousStationId.current = station?.id ?? null;
      return;
    }

    if (previousNearestResult.current && !nearestStationResult) {
      previousNearestResult.current = null;
      previousStationId.current = station?.id ?? null;
      return;
    }

    if (!station) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, {
        animate: false
      });
      previousStationId.current = null;
      return;
    }

    if (previousStationId.current !== station.id) {
      map.setView([station.lat, station.lng], 13, {
        animate: false
      });
    }

    previousStationId.current = station.id;
  }, [map, nearestStationResult, station]);

  return null;
}

type MapZoomTrackerProps = {
  onZoomChange: (zoom: number) => void;
};

function ZoomControls() {
  const map = useMap();
  return (
    <div className="mapZoomControls">
      <button type="button" className="zoomBtn" onClick={() => map.zoomIn()} aria-label="Zoom in">+</button>
      <button type="button" className="zoomBtn" onClick={() => map.zoomOut()} aria-label="Zoom out">−</button>
    </div>
  );
}

function MapZoomTracker({ onZoomChange }: MapZoomTrackerProps) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}


const VRE_DIAMOND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="12" height="12" class="stationVreIcon"><polygon points="10,1 19,10 10,19 1,10" fill="#EE3E42"/><ellipse cx="10" cy="10" rx="6" ry="4" fill="white"/><text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="4.5" font-weight="700" fill="#1a1a1a">VRE</text><polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.6"/></svg>`;

const MARC_SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="8" height="8" class="stationMarcIcon"><defs><clipPath id="mc"><rect x="0" y="0" width="20" height="20" rx="4"/></clipPath></defs><rect x="0" y="0" width="10" height="20" fill="#F7941D" clip-path="url(#mc)"/><rect x="10" y="0" width="10" height="20" fill="#003DA5" clip-path="url(#mc)"/><rect x="0" y="0" width="20" height="20" rx="4" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.6"/></svg>`;

function createStationIcon(station: MetroStation, isSelected: boolean, marc?: MarcStation, vre?: VreStation, showMetro = true) {
  const metroWidth = showMetro ? Math.max(18, 10 + station.lines.length * 8) : 0;
  const dividerExtra = (marc || vre) ? (showMetro ? 7 : 0) : 0;
  const marcExtra = marc ? 12 : 0;
  const vreExtra = vre ? 12 : 0;
  const width = Math.max(18, metroWidth + dividerExtra + marcExtra + vreExtra);

  const dots = showMetro
    ? station.lines
        .map((line) => `<span class="stationStopDot" style="background:${LINE_COLORS[line] ?? "#385170"}"></span>`)
        .join("")
    : "";

  const transitPart = (marc || vre)
    ? `${showMetro ? '<span class="stationVreDivider"></span>' : ""}${marc ? MARC_SQUARE_SVG : ""}${vre ? VRE_DIAMOND_SVG : ""}`
    : "";

  return new DivIcon({
    className: "stationStopIcon",
    html: `<span class="stationStop${isSelected ? " selected" : ""}"><span class="stationStopDots">${dots}</span>${transitPart}</span>`,
    iconSize: [width, 18],
    iconAnchor: [Math.round(width / 2), 9]
  });
}

function createMarcStandaloneIcon(isSelected: boolean) {
  return new DivIcon({
    className: "stationStopIcon",
    html: `<span class="marcStandaloneStop${isSelected ? " selected" : ""}">${MARC_SQUARE_SVG}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function createVreStandaloneIcon(isSelected: boolean) {
  return new DivIcon({
    className: "stationStopIcon",
    html: `<span class="vreStandaloneStop${isSelected ? " selected" : ""}">${VRE_DIAMOND_SVG}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function createStationLabelIcon(name: string, isSelected: boolean) {
  const escapedName = escapeHtml(name);

  return new DivIcon({
    className: "stationLabelIcon",
    html: `<span class="stationMapLabel${isSelected ? " selected" : ""}">${escapedName}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, -14]
  });
}

function createNearestStationOverlayIcon(
  stationName: string,
  lineLabel: string,
  walkingMinutes: number,
  walkingMiles: string,
  compact: boolean,
  minimal: boolean
) {
  return new DivIcon({
    className: "nearestStationOverlayIcon",
    html: `
      <span class="nearestStationOverlayBubble${compact ? " compact" : ""}${minimal ? " minimal" : ""}">
        <span class="nearestStationOverlayClose" aria-hidden="true">×</span>
        <span class="nearestStationOverlayTitle">${escapeHtml(stationName)}</span>
        ${minimal ? "" : `<span class="nearestStationOverlayMeta">${escapeHtml(lineLabel)}</span>`}
        <span class="nearestStationOverlayMeta">${walkingMinutes} min walk • ${walkingMiles} mi</span>
      </span>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 64]
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getIsochroneColor(minutes: number) {
  if (ISOCHRONE_COLORS[minutes]) {
    return ISOCHRONE_COLORS[minutes];
  }

  const hue = Math.max(8, 210 - Math.min(minutes, 60) * 3);
  return `hsl(${hue} 52% 44%)`;
}
