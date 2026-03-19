export type BaseStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
};

export type StationWalkResult = {
  station: BaseStation;
  walkingDistanceMeters: number;
  walkingDurationSeconds: number;
  route: GeoJSON.LineString;
};

export type NearestStationResult = {
  matchedAddress: string;
  address: {
    lat: number;
    lng: number;
  };
  stations: StationWalkResult[];
};
