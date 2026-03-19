"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { NearestStationResult } from "@/lib/nearest-station";
import { WMATA_STATIONS } from "@/lib/wmata-stations";
import { VRE_STATIONS } from "@/lib/vre-stations";
import { MARC_STATIONS } from "@/lib/marc-stations";

const MetroMap = dynamic(() => import("@/components/metro-map").then((mod) => mod.MetroMap), {
  ssr: false
});

type MapThemePreference = "light" | "dark";
const PRESET_MINUTES = [5, 10, 15] as const;

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

function getIsochroneColor(minutes: number): string {
  if (ISOCHRONE_COLORS[minutes]) return ISOCHRONE_COLORS[minutes];
  const hue = Math.max(8, 210 - Math.min(minutes, 60) * 3);
  return `hsl(${hue} 52% 44%)`;
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="2.5" fill="currentColor" />
      <line x1="6.5" y1="0" x2="6.5" y2="2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6.5" y1="11" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="0" y1="6.5" x2="2" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11" y1="6.5" x2="13" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2.34" y1="2.34" x2="3.75" y2="3.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.25" y1="9.25" x2="10.66" y2="10.66" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="10.66" y1="2.34" x2="9.25" y2="3.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="3.75" y1="9.25" x2="2.34" y2="10.66" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M10.8 8.8C9.6 10.3 7.6 11.1 5.5 10.5C3.4 9.9 1.9 8 1.9 5.8C1.9 3.6 3.4 1.7 5.5 1.1C3.7 2.4 3.0 4.8 4.0 6.8C5.0 8.8 7.3 9.7 9.3 9.0C9.8 8.9 10.3 8.8 10.8 8.8Z" fill="currentColor" />
    </svg>
  );
}

export function MetroMapShell() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMinutes, setActiveMinutes] = useState<number[]>([]);
  const [availableCustomMinutes, setAvailableCustomMinutes] = useState<number[]>([]);
  const [customMinutesInput, setCustomMinutesInput] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [query, setQuery] = useState("");
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<MapThemePreference>("light");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [visibleTransit, setVisibleTransit] = useState({ metro: true, marc: true, vre: true });
  const [nearestStationResult, setNearestStationResult] = useState<NearestStationResult | null>(null);
  const [loadingIsochroneStationIds, setLoadingIsochroneStationIds] = useState<string[]>([]);
  const [addressStatus, setAddressStatus] = useState<"idle" | "loading" | "error">("idle");
  const [addressError, setAddressError] = useState("");
  const stationSearchRef = useRef<HTMLInputElement>(null);
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
    () => [
      ...WMATA_STATIONS.filter((station) => selectedIds.includes(station.id)),
      ...VRE_STATIONS.filter((station) => selectedIds.includes(station.id)),
      ...MARC_STATIONS.filter((station) => selectedIds.includes(station.id))
    ],
    [selectedIds]
  );
  const customMinutes = availableCustomMinutes.filter(
    (minutes) => !PRESET_MINUTES.includes(minutes as 5 | 10 | 15)
  );

  // Read URL state on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stationParam = params.get("stations");
    const minutesParam = params.get("minutes");

    if (stationParam) {
      const ids = stationParam.split(",").filter((id) => WMATA_STATIONS.some((s) => s.id === id));
      if (ids.length > 0) setSelectedIds(ids);
    }

    if (minutesParam) {
      const minutes = minutesParam.split(",").map(Number).filter((n) => n > 0 && n <= 60);
      if (minutes.length > 0) {
        setActiveMinutes(minutes);
        const custom = minutes.filter((m) => !PRESET_MINUTES.includes(m as 5 | 10 | 15));
        if (custom.length > 0) setAvailableCustomMinutes(custom);
      }
    }
  }, []);

  // Write URL state when selection changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedIds.length > 0) params.set("stations", selectedIds.join(","));
    if (activeMinutes.length > 0) params.set("minutes", activeMinutes.join(","));
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [selectedIds, activeMinutes]);

  // Keyboard shortcut: "/" to focus station search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        stationSearchRef.current?.focus();
        if (isMobile) setSidebarOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  function toggleStation(id: string, options?: { focusMap?: boolean }) {
    const focusMap = options?.focusMap ?? false;
    const isSelected = selectedIds.includes(id);
    const nextSelection = isSelected
      ? selectedIds.filter((stationId) => stationId !== id)
      : [id, ...selectedIds];

    setSelectedIds(nextSelection);

    if (focusMap) {
      if (!isSelected) {
        setFocusedStationId(id);
      }
      return;
    }
  }

  function focusStation(id: string) {
    setFocusedStationId(id);
  }

  function removeSelectedStation(id: string) {
    setSelectedIds((current) => current.filter((stationId) => stationId !== id));
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

  function clearNearestStation() {
    setNearestStationResult(null);
    setAddressQuery("");
    setAddressStatus("idle");
    setAddressError("");
  }

  async function findNearestStation() {
    const trimmedAddress = addressQuery.trim();

    if (!trimmedAddress) {
      return;
    }

    setAddressStatus("loading");
    setAddressError("");

    try {
      const params = new URLSearchParams({
        address: trimmedAddress
      });
      const response = await fetch(`/api/nearest-station?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as NearestStationResult | { error?: string };
      const errorPayload = payload as { error?: string };

      if (!response.ok) {
        setAddressStatus("error");
        setAddressError(errorPayload.error ?? "Unable to look up that address.");
        return;
      }

      if (!("stations" in payload) || !Array.isArray(payload.stations) || payload.stations.length === 0) {
        setAddressStatus("error");
        setAddressError("Unable to look up that address.");
        return;
      }

      setNearestStationResult(payload);
      setAddressStatus("idle");
      setAddressError("");

      // Auto-select all stations within 15-min walk (newest on top).
      setSelectedIds((prev) => {
        const incoming = payload.stations.map((s: { station: { id: string } }) => s.station.id);
        const filtered = incoming.filter((id: string) => !prev.includes(id));
        return [...filtered.reverse(), ...prev];
      });

      setFocusedStationId(payload.stations[0].station.id);
      if (isMobile) {
        setSidebarOpen(false);
      }
    } catch {
      setAddressStatus("error");
      setAddressError("Unable to look up that address.");
    }
  }

  const nearestWalk = nearestStationResult?.stations[0] ?? null;
  const walkingDistanceMiles = nearestWalk
    ? (nearestWalk.walkingDistanceMeters / 1609.344).toFixed(1)
    : null;
  const walkingMinutes = nearestWalk
    ? Math.max(1, Math.round(nearestWalk.walkingDurationSeconds / 60))
    : null;

  return (
    <main className="shell" data-theme={resolvedTheme} data-sidebar={sidebarOpen ? "open" : "closed"}>
      <section id="station-drawer" className="sidebar" aria-hidden={!sidebarOpen}>
        <div className="hero desktopOnly">
          <p className="eyebrow">DMV Stations</p>
          <h1>Walkable Transit Map</h1>
          <p className="lede">
            Find stations near you or explore walkable access across DC's Metro, MARC, and VRE networks.
          </p>
        </div>

        <div className="sidebarSection layersSection">
          <div className="sectionHeader">
            <span className="sectionEyebrow">Layers</span>
            <h2>Filter transit on the map</h2>
          </div>
          <div className="controls transitLayerRow">
            <div className="toggleRow">
              {([
                { key: "metro", logo: "/metro-logo.svg", alt: "Metro", color: "#0d63ae", logoH: 26 },
                { key: "marc",  logo: "/marc-logo.svg",  alt: "MARC",  color: "#F7941D", logoH: 17 },
                { key: "vre",   logo: "/vre-logo.svg",   alt: "VRE",   color: "#EE3E42", logoH: 26 }
              ] as const).map(({ key, logo, alt, color, logoH }) => {
                const active = visibleTransit[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className={active ? "toggle layerToggle active" : "toggle layerToggle"}
                    onClick={() => setVisibleTransit((prev) => ({ ...prev, [key]: !prev[key] }))}
                    style={active ? { background: color, borderColor: "transparent" } : { borderColor: color }}
                  >
                    <img
                      src={logo}
                      alt={alt}
                      height={logoH}
                      style={{
                      width: "auto",
                      display: "block",
                      filter: active
                        ? key === "vre"
                          ? "drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff)"
                          : "brightness(0) invert(1)"
                        : "none"
                    }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sidebarSection addressSection">
          <div className="sectionHeader">
            <span className="sectionEyebrow">Address lookup</span>
            <h2>Find the nearest station</h2>
          </div>
          <div className="controls addressLookup">
            <span>Enter an address</span>
            <div className="customTimeRow">
              <input
                type="search"
                value={addressQuery}
                onChange={(event) => setAddressQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void findNearestStation();
                  }
                }}
                placeholder="123 Main St NW"
                aria-label="Enter an address to find the nearest station"
              />
              <button
                type="button"
                className="toggle primaryBtn"
                onClick={() => {
                  void findNearestStation();
                }}
                disabled={addressStatus === "loading"}
              >
                {addressStatus === "loading" ? (
                  <span className="loadingDots" aria-label="Loading" role="status">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  "Go"
                )}
              </button>
            </div>
            {addressError ? <p className="controlNote errorText">{addressError}</p> : null}
          </div>
        </div>

        <div className="sidebarSection shedSection">
          <div className="sectionHeader">
            <span className="sectionEyebrow">Walking sheds</span>
            <h2>Explore station access</h2>
          </div>

          <div className="controls">
            <span>Walking time</span>
            <div className="toggleRow">
              {PRESET_MINUTES.map((minutes) => {
                const active = activeMinutes.includes(minutes);
                const color = getIsochroneColor(minutes);

                return (
                  <button
                    key={minutes}
                    type="button"
                    className={active ? "toggle active" : "toggle"}
                    onClick={() => toggleMinutes(minutes)}
                    style={active ? { background: color, borderColor: "transparent", color: "#fff" } : { borderColor: color, color: color }}
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
                  const color = getIsochroneColor(minutes);

                  return (
                    <button
                      key={minutes}
                      type="button"
                      className={active ? "toggle active" : "toggle"}
                      onClick={() => toggleMinutes(minutes)}
                      style={active ? { background: color, borderColor: "transparent", color: "#fff" } : { borderColor: color, color: color }}
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
                className="toggle primaryBtn"
                onClick={addCustomMinutes}
              >
                Add
              </button>
            </div>
          </div>

          <label className="search">
            <span>Search for a station</span>
            <input
              ref={stationSearchRef}
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
                          if (isMobile) setSidebarOpen(false);
                        }}
                      >
                        <span className="stationName">{station.name}</span>
                        <span className="stationLines">
                          {station.lines.map((line) => (
                            <span key={line} className="stationLineTag">
                              <span className="stationLineDot" style={{ background: LINE_COLORS[line] ?? "#385170" }} />
                              {line}
                            </span>
                          ))}
                        </span>
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
              <div className="selectionMeta">
                <span className="selectedStationLabel">Selected stations</span>
                <button type="button" onClick={() => setSelectedIds([])}>
                  Clear all
                </button>
              </div>
              <div className="selectedStationList">
                {selectedStations.map((station) => (
                  <div key={station.id} className="searchResult selected selectedStationItem">
                    <button
                      type="button"
                      className="selectedStationButton"
                      onClick={() => focusStation(station.id)}
                    >
                      <span className="stationName">{station.name}</span>
                      <span className="stationLines">
                        {station.lines.map((line) => (
                          <span key={line} className="stationLineTag">
                            <span className="stationLineDot" style={{ background: LINE_COLORS[line] ?? "#385170" }} />
                            {line}
                          </span>
                        ))}
                      </span>
                    </button>
                    {loadingIsochroneStationIds.includes(station.id) ? (
                      <span className="selectedStationLoading" aria-label="Loading walk shed" role="status">
                        <span className="loadingDots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="selectedStationRemove"
                        onClick={() => removeSelectedStation(station.id)}
                        aria-label={`Remove ${station.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedIds.length > 0 && activeMinutes.length === 0 && (
            <p className="controlNote walkTimeHint">Select a walk time above to see the walking shed</p>
          )}
        </div>

      </section>

      <button
        type="button"
        className="drawerHandle"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-expanded={sidebarOpen}
        aria-controls="station-drawer"
        aria-label={sidebarOpen ? "Hide controls" : "Show controls"}
      >
        <img
          src="/right.png"
          alt=""
          aria-hidden="true"
          className={`drawerHandleIcon ${sidebarOpen ? "open" : "closed"}`}
        />
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
          nearestStationResult={nearestStationResult}
          onClearNearestStation={clearNearestStation}
          onIsochroneLoadingChange={setLoadingIsochroneStationIds}
          onToggleStation={toggleStation}
          vreStations={VRE_STATIONS}
          marcStations={MARC_STATIONS}
          visibleTransit={visibleTransit}
        />
        {activeMinutes.length > 0 && (
          <div className="isochroneLegend" aria-label="Walking shed legend">
            {activeMinutes.map((minutes) => (
              <div key={minutes} className="legendItem">
                <span className="legendSwatch" style={{ background: getIsochroneColor(minutes) }} />
                <span>{minutes} min</span>
              </div>
            ))}
          </div>
        )}
        <div className="mapThemeToggle" aria-label="Map theme controls">
          {(["light", "dark"] as const).map((theme) => {
            const active = themePreference === theme;

            return (
              <button
                key={theme}
                type="button"
                className={active ? "toggle active themeToggleBtn" : "toggle themeToggleBtn"}
                onClick={() => setThemePreference(theme)}
                aria-pressed={active}
                aria-label={theme === "light" ? "Light map" : "Dark map"}
              >
                {theme === "light" ? <SunIcon /> : <MoonIcon />}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
