const WALK_SPEED_METERS_PER_MINUTE = 80;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function metersToLat(meters: number) {
  return meters / 111_320;
}

function metersToLng(meters: number, latitude: number) {
  return meters / (111_320 * Math.cos(toRadians(latitude)));
}

function buildPolygon(lat: number, lng: number, minutes: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const baseRadius = minutes * WALK_SPEED_METERS_PER_MINUTE;
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= 36; step += 1) {
    const angle = (step / 36) * Math.PI * 2;
    const pulse = 0.84 + (Math.sin(angle * 3) + 1) * 0.08 + (Math.cos(angle * 5) + 1) * 0.04;
    const meters = baseRadius * pulse;
    const latOffset = metersToLat(meters * Math.sin(angle));
    const lngOffset = metersToLng(meters * Math.cos(angle), lat);

    coordinates.push([Number((lng + lngOffset).toFixed(6)), Number((lat + latOffset).toFixed(6))]);
  }

  return {
    type: "Feature",
    properties: {
      minutes
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  };
}

export function buildFallbackIsochrones(
  lat: number,
  lng: number
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: [buildPolygon(lat, lng, 5), buildPolygon(lat, lng, 15)]
  };
}
