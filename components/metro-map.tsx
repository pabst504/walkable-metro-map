"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  Marker,
  useMap,
  useMapEvents
} from "react-leaflet";
import { DivIcon } from "leaflet";
import type { PathOptions } from "leaflet";
import type { MetroStation } from "@/lib/wmata-stations";

type IsochroneCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

type MetroMapProps = {
  stations: MetroStation[];
  selectedStations: MetroStation[];
  activeMinutes: number[];
  focusedStationId: string | null;
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
  15: "#bf4342"
};

const DEFAULT_MAP_CENTER: [number, number] = [38.9072, -77.0369];
const DEFAULT_MAP_ZOOM = 11;
const SELECTED_STATION_LABEL_MIN_ZOOM = 11;
const ALL_STATION_LABEL_MIN_ZOOM = 13;
const STREET_LABEL_MIN_ZOOM = 13;

export function MetroMap({
  stations,
  selectedStations,
  activeMinutes,
  focusedStationId,
  onToggleStation
}: MetroMapProps) {
  const [isochronesByStation, setIsochronesByStation] = useState<Record<string, IsochroneCollection>>({});
  const [zoom, setZoom] = useState(0);
  const focusedStation = stations.find((station) => station.id === focusedStationId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadIsochrones() {
      const missingStations = selectedStations.filter((station) => !isochronesByStation[station.id]);

      if (missingStations.length === 0) {
        return;
      }

      const requests = await Promise.all(
        missingStations.map(async (station) => {
          const response = await fetch(`/api/isochrones?lat=${station.lat}&lng=${station.lng}`, {
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
            next[stationId] = data;
          }

          return next;
        });
      }
    }

    void loadIsochrones();

    return () => {
      cancelled = true;
    };
  }, [isochronesByStation, selectedStations]);

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      className="mapCanvas"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />
      {zoom >= STREET_LABEL_MIN_ZOOM ? (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          pane="overlayPane"
        />
      ) : null}

      <MapZoomTracker onZoomChange={setZoom} />
      <MapViewController station={focusedStation} />

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
              color: ISOCHRONE_COLORS[minutes] ?? "#4c6a92",
              weight: 2,
              fillOpacity: minutes === 5 ? 0.18 : 0.1,
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
};

function MapViewController({ station }: MapViewControllerProps) {
  const map = useMap();
  const hasInitialized = useRef(false);

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

    if (!station) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, {
        animate: false
      });
      return;
    }

    map.setView([station.lat, station.lng], 13, {
      animate: false
    });
  }, [map, station]);

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
