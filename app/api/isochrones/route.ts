import { NextRequest, NextResponse } from "next/server";
import { buildFallbackIsochrones } from "@/lib/isochrones";

type OpenRouteServiceFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> & {
  properties: {
    value?: number;
  };
};

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid station coordinates." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(buildFallbackIsochrones(lat, lng));
  }

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/isochrones/foot-walking", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [300, 900],
        range_type: "time",
        location_type: "start",
        attributes: ["area", "reachfactor"]
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json(buildFallbackIsochrones(lat, lng));
    }

    const data = (await response.json()) as GeoJSON.FeatureCollection<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      Record<string, unknown>
    >;

    const normalized = {
      type: "FeatureCollection",
      features: (data.features ?? []).map((feature) => {
        const typedFeature = feature as OpenRouteServiceFeature;
        const seconds = typedFeature.properties?.value ?? 0;

        return {
          ...typedFeature,
          properties: {
            ...typedFeature.properties,
            minutes: Math.round(seconds / 60)
          }
        };
      })
    } satisfies GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

    return NextResponse.json(normalized);
  } catch {
    return NextResponse.json(buildFallbackIsochrones(lat, lng));
  }
}
