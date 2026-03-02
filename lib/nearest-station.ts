import type { MetroStation } from "@/lib/wmata-stations";

export type NearestStationResult = {
  matchedAddress: string;
  address: {
    lat: number;
    lng: number;
  };
  station: MetroStation;
  walkingDistanceMeters: number;
  walkingDurationSeconds: number;
  route: GeoJSON.LineString;
};
