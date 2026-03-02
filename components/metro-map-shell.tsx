"use client";

import { useDeferredValue, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { WMATA_STATIONS } from "@/lib/wmata-stations";

const MetroMap = dynamic(() => import("@/components/metro-map").then((mod) => mod.MetroMap), {
  ssr: false
});

export function MetroMapShell() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMinutes, setActiveMinutes] = useState<number[]>([5, 15]);
  const [query, setQuery] = useState("");
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const filteredStations = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return WMATA_STATIONS;
    }

    return WMATA_STATIONS.filter((station) => {
      const haystack = `${station.name} ${station.lines.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [deferredQuery]);

  const selectedStations = useMemo(
    () => WMATA_STATIONS.filter((station) => selectedIds.includes(station.id)),
    [selectedIds]
  );

  function toggleStation(id: string, options?: { focusMap?: boolean }) {
    const focusMap = options?.focusMap ?? false;
    const isSelected = selectedIds.includes(id);
    const nextSelection = isSelected
      ? selectedIds.filter((stationId) => stationId !== id)
      : [...selectedIds, id];

    setSelectedIds(nextSelection);

    if (focusMap) {
      setFocusedStationId(isSelected ? null : id);
      return;
    }

    if (isSelected && focusedStationId === id) {
      setFocusedStationId(null);
    }
  }

  function toggleMinutes(minutes: number) {
    setActiveMinutes((current) =>
      current.includes(minutes)
        ? current.filter((value) => value !== minutes)
        : [...current, minutes].sort((a, b) => a - b)
    );
  }

  return (
    <main className="shell">
      <section className="sidebar">
        <div className="hero">
          <p className="eyebrow">Walkable WMATA</p>
          <h1>Metro stops + 5 and 15 minute walking sheds</h1>
          <p className="lede">
            Click stations on the map or in the list to toggle them. The app uses OpenRouteService
            network isochrones when a key is configured and falls back to generated walk buffers if
            it is not.
          </p>
        </div>

        <label className="search">
          <span>Find a station</span>
          <input
            type="search"
            placeholder="Fort Totten, Silver, Red..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="controls">
          <span>Walking time</span>
          <div className="toggleRow">
            {[5, 15].map((minutes) => {
              const active = activeMinutes.includes(minutes);

              return (
                <button
                  key={minutes}
                  type="button"
                  className={active ? "toggle active" : "toggle"}
                  onClick={() => toggleMinutes(minutes)}
                >
                  {minutes} min
                </button>
              );
            })}
          </div>
        </div>

        <div className="selectionMeta">
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            onClick={() => {
              setSelectedIds([]);
              setFocusedStationId(null);
            }}
            disabled={selectedIds.length === 0}
          >
            Deselect all stations
          </button>
        </div>

        <div className="stationList">
          {filteredStations.map((station) => {
            const isSelected = selectedIds.includes(station.id);

            return (
              <button
                key={station.id}
                type="button"
                className={isSelected ? "stationRow selected" : "stationRow"}
                onClick={() => toggleStation(station.id, { focusMap: true })}
              >
                <span className="stationName">{station.name}</span>
                <span className="stationLines">{station.lines.join(" / ")}</span>
              </button>
            );
          })}
        </div>

        <p className="note">
          Select multiple stations to compare overlaps.
        </p>
      </section>

      <section className="mapPanel">
        <MetroMap
          stations={WMATA_STATIONS}
          selectedStations={selectedStations}
          activeMinutes={activeMinutes}
          focusedStationId={focusedStationId}
          onToggleStation={toggleStation}
        />
      </section>
    </main>
  );
}
