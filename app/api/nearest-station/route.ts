import { NextRequest, NextResponse } from "next/server";
import { WMATA_STATIONS } from "@/lib/wmata-stations";
import { VRE_STATIONS } from "@/lib/vre-stations";
import { MARC_STATIONS } from "@/lib/marc-stations";
import type { NearestStationResult, BaseStation } from "@/lib/nearest-station";

type GeocodeFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    label?: string;
  };
};

type DirectionsFeature = {
  geometry?: GeoJSON.LineString;
  properties?: {
    summary?: {
      distance?: number;
      duration?: number;
    };
  };
};

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!address) {
    return NextResponse.json({ error: "Address is required." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTESERVICE_API_KEY is required for address lookup." },
      { status: 503 }
    );
  }

  try {
    const geocodeUrl = new URL("https://api.openrouteservice.org/geocode/search");
    geocodeUrl.searchParams.set("api_key", apiKey);
    geocodeUrl.searchParams.set("text", address);
    geocodeUrl.searchParams.set("size", "1");
    geocodeUrl.searchParams.set("boundary.country", "USA");

    const geocodeResponse = await fetch(geocodeUrl, {
      cache: "no-store"
    });

    if (!geocodeResponse.ok) {
      return NextResponse.json({ error: "Unable to geocode that address." }, { status: 502 });
    }

    const geocodeData = (await geocodeResponse.json()) as {
      features?: GeocodeFeature[];
    };
    const feature = geocodeData.features?.[0];
    const coordinates = feature?.geometry?.coordinates;

    if (!coordinates || coordinates.length < 2) {
      return NextResponse.json({ error: "No address match found." }, { status: 404 });
    }

    const [originLng, originLat] = coordinates;

    // 15 min walk at ~80 m/min = 1200 m. Use 1800 m haversine buffer to
    // account for real routes being longer than straight-line distance.
    const MAX_WALK_SECONDS = 15 * 60;
    const HAVERSINE_BUFFER_METERS = 1800;

    const allStations: BaseStation[] = [
      ...WMATA_STATIONS,
      // Skip co-located VRE/MARC stations — the Metro station at the same spot covers them
      ...VRE_STATIONS.filter((v) => !v.metroStationId),
      ...MARC_STATIONS.filter((m) => !m.metroStationId)
    ];

    const candidateStations = allStations.filter(
      (station) =>
        haversineDistance(originLat, originLng, station.lat, station.lng) <=
        HAVERSINE_BUFFER_METERS
    );

    type RouteCandidate = {
      station: BaseStation;
      geometry: GeoJSON.LineString;
      distanceMeters: number;
      durationSeconds: number;
    };

    const routeCandidates = (
      await Promise.all(
        candidateStations.map(async (station): Promise<RouteCandidate | null> => {
          const directionsResponse = await fetch(
            "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
            {
              method: "POST",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                coordinates: [
                  [originLng, originLat],
                  [station.lng, station.lat]
                ]
              }),
              cache: "no-store"
            }
          );

          if (!directionsResponse.ok) return null;

          const directionsData = (await directionsResponse.json()) as {
            features?: DirectionsFeature[];
          };
          const routeFeature = directionsData.features?.[0];
          const geometry = routeFeature?.geometry;
          const distance = routeFeature?.properties?.summary?.distance;
          const duration = routeFeature?.properties?.summary?.duration;

          if (!geometry || !Number.isFinite(distance) || !Number.isFinite(duration)) {
            return null;
          }

          return {
            station,
            geometry,
            distanceMeters: Number(distance),
            durationSeconds: Number(duration)
          };
        })
      )
    ).filter((v): v is RouteCandidate => v !== null);

    // Keep only stations reachable within 15 min, sorted nearest first.
    const withinRange = routeCandidates
      .filter((c) => c.durationSeconds <= MAX_WALK_SECONDS)
      .sort((a, b) => a.durationSeconds - b.durationSeconds);

    // Fallback: if nothing is within 15 min, return the single closest station.
    const results =
      withinRange.length > 0
        ? withinRange
        : routeCandidates.sort((a, b) => a.durationSeconds - b.durationSeconds).slice(0, 1);

    if (results.length === 0) {
      return NextResponse.json(
        { error: "Unable to compute a walking route to nearby stations." },
        { status: 502 }
      );
    }

    const result: NearestStationResult = {
      matchedAddress: feature?.properties?.label ?? address,
      address: {
        lat: originLat,
        lng: originLng
      },
      stations: results.map((r) => ({
        station: r.station,
        walkingDistanceMeters: r.distanceMeters,
        walkingDurationSeconds: r.durationSeconds,
        route: r.geometry
      }))
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to look up that address right now." }, { status: 500 });
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
