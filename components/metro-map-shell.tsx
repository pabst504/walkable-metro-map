"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { WMATA_STATIONS } from "@/lib/wmata-stations";

const MetroMap = dynamic(() => import("@/components/metro-map").then((mod) => mod.MetroMap), {
  ssr: false
});

type MapThemePreference = "light" | "dark";
const PRESET_MINUTES = [5, 10, 15] as const;

export function MetroMapShell() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMinutes, setActiveMinutes] = useState<number[]>([5]);
  const [availableCustomMinutes, setAvailableCustomMinutes] = useState<number[]>([]);
  const [customMinutesInput, setCustomMinutesInput] = useState("");
  const [query, setQuery] = useState("");
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<MapThemePreference>("light");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setThemePreference(mediaQuery.matches ? "dark" : "light");
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const applyMobileState = () => {
      setIsMobile(mediaQuery.matches);
    };

    applyMobileState();
    mediaQuery.addEventListener("change", applyMobileState);

    return () => {
      mediaQuery.removeEventListener("change", applyMobileState);
    };
  }, []);
  const resolvedTheme = themePreference;

  const filteredStations = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    const matchingStations = WMATA_STATIONS.filter((station) => {
      const haystack = `${station.name} ${station.lines.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return [...matchingStations].sort((left, right) => {
      const leftIndex = selectedIds.indexOf(left.id);
      const rightIndex = selectedIds.indexOf(right.id);
      const leftSelected = leftIndex !== -1;
      const rightSelected = rightIndex !== -1;

      if (leftSelected && rightSelected) {
        return rightIndex - leftIndex;
      }

      if (leftSelected) {
        return -1;
      }

      if (rightSelected) {
        return 1;
      }

      return 0;
    });
  }, [deferredQuery, selectedIds]);

  const selectedStations = useMemo(
    () => WMATA_STATIONS.filter((station) => selectedIds.includes(station.id)),
    [selectedIds]
  );
  const customMinutes = availableCustomMinutes.filter(
    (minutes) => !PRESET_MINUTES.includes(minutes as 5 | 10 | 15)
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

  function addCustomMinutes() {
    const parsedMinutes = Number(customMinutesInput);

    if (!Number.isFinite(parsedMinutes)) {
      return;
    }

    const normalizedMinutes = Math.max(1, Math.min(60, Math.round(parsedMinutes)));
    setAvailableCustomMinutes((current) =>
      current.includes(normalizedMinutes) ? current : [...current, normalizedMinutes].sort((a, b) => a - b)
    );
    setActiveMinutes((current) =>
      current.includes(normalizedMinutes) ? current : [...current, normalizedMinutes].sort((a, b) => a - b)
    );
    setCustomMinutesInput("");
  }

  return (
    <main className="shell" data-theme={resolvedTheme} data-sidebar={sidebarOpen ? "open" : "closed"}>
      <section id="station-drawer" className="sidebar" aria-hidden={!sidebarOpen}>
        <div className="hero desktopOnly">
          <p className="eyebrow">WMATA Stations</p>
          <h1>Walkable Metro Map</h1>
          <p className="lede">
            Choose stations on the map or from the search box to explore walk times around each
            station.
          </p>
        </div>

        <div className="controls">
          <span>Walking time</span>
          <div className="toggleRow">
            {PRESET_MINUTES.map((minutes) => {
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
          {customMinutes.length > 0 ? (
            <div className="toggleRow customToggleRow">
              {customMinutes.map((minutes) => {
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
          ) : null}
          <div className="customTimeRow">
            <input
              type="number"
              min={1}
              max={60}
              step={1}
              inputMode="numeric"
              value={customMinutesInput}
              onChange={(event) => setCustomMinutesInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomMinutes();
                }
              }}
              placeholder="Walk Time"
              aria-label="Custom walking time in minutes"
            />
            <button
              type="button"
              className="toggle"
              onClick={addCustomMinutes}
            >
              Add
            </button>
          </div>
          <p className="controlNote">Use the presets or add your own time.</p>
        </div>

        <div className="selectionMeta desktopOnly">
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            onClick={() => {
              setSelectedIds([]);
            }}
            disabled={selectedIds.length === 0}
          >
            Deselect all stations
          </button>
        </div>

        <label className="search">
          <span>Find a station</span>
          <input
            type="search"
            placeholder="Fort Totten, Silver, Red..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {deferredQuery.trim() ? (
            <div className="searchResults" role="listbox" aria-label="Station search results">
              {filteredStations.length > 0 ? (
                filteredStations.map((station) => {
                  const isSelected = selectedIds.includes(station.id);

                  return (
                    <button
                      key={station.id}
                      type="button"
                      className={isSelected ? "searchResult selected" : "searchResult"}
                      onClick={() => {
                        toggleStation(station.id, { focusMap: true });
                        setQuery("");
                      }}
                    >
                      <span className="stationName">{station.name}</span>
                      <span className="stationLines">{station.lines.join(" / ")}</span>
                    </button>
                  );
                })
              ) : (
                <p className="searchEmpty">No matching stations.</p>
              )}
            </div>
          ) : null}
        </label>

        {!isMobile && selectedStations.length > 0 ? (
          <div className="selectedStationStack">
            <span className="selectedStationLabel">Selected stations</span>
            <div className="selectedStationList">
              {selectedStations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className="searchResult selected"
                  onClick={() => toggleStation(station.id, { focusMap: true })}
                >
                  <span className="stationName">{station.name}</span>
                  <span className="stationLines">{station.lines.join(" / ")}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="note desktopOnly">
          Select multiple stations to compare overlaps.
        </p>
      </section>

      <button
        type="button"
        className="drawerHandle"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-expanded={sidebarOpen}
        aria-controls="station-drawer"
        aria-label={sidebarOpen ? "Hide controls" : "Show controls"}
      >
        <span className={`drawerArrowTab ${sidebarOpen ? "open" : "closed"}`} aria-hidden="true">
          <span className="drawerArrowShaft" />
          <span className="drawerArrowHead" />
        </span>
      </button>

      <section className="mapPanel">
        <MetroMap
          stations={WMATA_STATIONS}
          selectedStations={selectedStations}
          activeMinutes={activeMinutes}
          focusedStationId={focusedStationId}
          theme={resolvedTheme}
          onToggleStation={toggleStation}
        />
        <div className="mapThemeToggle" aria-label="Map theme controls">
          {(["light", "dark"] as const).map((theme) => {
            const active = themePreference === theme;

            return (
              <button
                key={theme}
                type="button"
                className={active ? "toggle active" : "toggle"}
                onClick={() => setThemePreference(theme)}
                aria-pressed={active}
              >
                {theme}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
