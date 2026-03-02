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

type IsochroneCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

type MetroMapProps = {
  stations: MetroStation[];
  selectedStations: MetroStation[];
  activeMinutes: number[];
  focusedStationId: string | null;
  theme: "light" | "dark";
  nearestStationResult: NearestStationResult | null;
  onClearNearestStation: () => void;
  onIsochroneLoadingChange: (stationIds: string[]) => void;
  onToggleStation: (id: string, options?: { focusMap?: boolean }) => void;
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
  onToggleStation
}: MetroMapProps) {
  const [isochronesByStation, setIsochronesByStation] = useState<Record<string, IsochroneCollection>>({});
  const [loadingStationIds, setLoadingStationIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0);
  const [isNearestOverlayVisible, setIsNearestOverlayVisible] = useState(true);
  const focusedStation = stations.find((station) => station.id === focusedStationId) ?? null;
  const baseMapVariant = theme === "dark" ? "dark_nolabels" : "light_nolabels";
  const labelMapVariant = theme === "dark" ? "dark_only_labels" : "light_only_labels";

  useEffect(() => {
    if (nearestStationResult) {
      setIsNearestOverlayVisible(true);
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
        .filter((value): value is { station: MetroStation; missingMinutes: number[] } => value !== null);

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
      <MapViewController station={focusedStation} nearestStationResult={nearestStationResult} />

      {nearestStationResult ? (
        <>
          <Polyline
            positions={nearestStationResult.route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: theme === "dark" ? "#8fd5e1" : "#1f7a8c",
              weight: 4,
              opacity: 0.85
            }}
          />
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
          {isNearestOverlayVisible ? (
            <Marker
              position={[
                (nearestStationResult.address.lat + nearestStationResult.station.lat) / 2,
                (nearestStationResult.address.lng + nearestStationResult.station.lng) / 2
              ]}
              icon={createNearestStationOverlayIcon(
                nearestStationResult.station.name,
                nearestStationResult.station.lines.join(" / "),
                Math.max(1, Math.round(nearestStationResult.walkingDurationSeconds / 60)),
                (nearestStationResult.walkingDistanceMeters / 1609.344).toFixed(1),
                zoom < 13,
                zoom < 11
              )}
              eventHandlers={{
                click: () => {
                  setIsNearestOverlayVisible(false);
                  onClearNearestStation();
                }
              }}
            />
          ) : null}
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
        const isSelected = selectedStations.some((selected) => selected.id === station.id);
        const shouldShowLabel =
          zoom >= ALL_STATION_LABEL_MIN_ZOOM || (isSelected && zoom >= SELECTED_STATION_LABEL_MIN_ZOOM);

        return (
          <Fragment key={station.id}>
            <Marker
              position={[station.lat, station.lng]}
              icon={createStationIcon(station, isSelected)}
              eventHandlers={{
                click: () => onToggleStation(station.id, { focusMap: false })
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <strong>{station.name}</strong>
                <br />
                {station.lines.join(" / ")}
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
      map.fitBounds(
        [
          [nearestStationResult.address.lat, nearestStationResult.address.lng],
          [nearestStationResult.station.lat, nearestStationResult.station.lng]
        ],
        {
          padding: [80, 80]
        }
      );
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


function createStationIcon(station: MetroStation, isSelected: boolean) {
  const width = Math.max(18, 10 + station.lines.length * 8);
  const dots = station.lines
    .map(
      (line) =>
        `<span class="stationStopDot" style="background:${LINE_COLORS[line] ?? "#385170"}"></span>`
    )
    .join("");

  return new DivIcon({
    className: "stationStopIcon",
    html: `<span class="stationStop${isSelected ? " selected" : ""}"><span class="stationStopDots">${dots}</span></span>`,
    iconSize: [width, 18],
    iconAnchor: [Math.round(width / 2), 9]
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
        <span class="nearestStationOverlayClose" aria-hidden="true">x</span>
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
