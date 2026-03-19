export type VreLine = "Manassas" | "Fredericksburg";

export type VreStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: VreLine[];
  /** ID of the WMATA station at the same location, if any */
  metroStationId?: string;
};

export const VRE_STATIONS: VreStation[] = [
  // ── Shared by both lines ────────────────────────────────────────────────
  {
    id: "vre-union-station",
    name: "Washington Union Station",
    lat: 38.8974,
    lng: -77.0066,
    lines: ["Manassas", "Fredericksburg"],
    metroStationId: "union-station"
  },
  {
    id: "vre-lenfant",
    name: "L'Enfant",
    lat: 38.8841,
    lng: -77.0219,
    lines: ["Manassas", "Fredericksburg"],
    metroStationId: "lenfant-plaza"
  },
  {
    id: "vre-alexandria",
    name: "Alexandria",
    lat: 38.8062,
    lng: -77.0611,
    lines: ["Manassas", "Fredericksburg"],
    metroStationId: "king-st"
  },

  {
    id: "vre-franconia-springfield",
    name: "Franconia-Springfield",
    lat: 38.7661,
    lng: -77.1679,
    lines: ["Manassas", "Fredericksburg"],
    metroStationId: "franconia-springfield"
  },

  // ── Fredericksburg Line only ────────────────────────────────────────────
  {
    id: "vre-crystal-city",
    name: "Crystal City",
    lat: 38.8578,
    lng: -77.0503,
    lines: ["Fredericksburg"],
    metroStationId: "crystal-city"
  },
  {
    id: "vre-lorton",
    name: "Lorton",
    lat: 38.7151,
    lng: -77.2145,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-woodbridge",
    name: "Woodbridge",
    lat: 38.6591,
    lng: -77.2482,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-rippon",
    name: "Rippon",
    lat: 38.6124,
    lng: -77.2533,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-brooke",
    name: "Brooke",
    lat: 38.3876,
    lng: -77.3818,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-quantico",
    name: "Quantico",
    lat: 38.5217,
    lng: -77.2931,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-leeland-road",
    name: "Leeland Road",
    lat: 38.3469,
    lng: -77.4378,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-fredericksburg",
    name: "Fredericksburg",
    lat: 38.2984,
    lng: -77.4569,
    lines: ["Fredericksburg"]
  },
  {
    id: "vre-spotsylvania",
    name: "Spotsylvania",
    lat: 38.2214,
    lng: -77.4410,
    lines: ["Fredericksburg"]
  },

  // ── Manassas Line only ──────────────────────────────────────────────────
  {
    id: "vre-backlick-road",
    name: "Backlick Road",
    lat: 38.7964,
    lng: -77.1842,
    lines: ["Manassas"]
  },
  {
    id: "vre-rolling-road",
    name: "Rolling Road",
    lat: 38.7947,
    lng: -77.2586,
    lines: ["Manassas"]
  },
  {
    id: "vre-burke-centre",
    name: "Burke Centre",
    lat: 38.7974,
    lng: -77.2988,
    lines: ["Manassas"]
  },
  {
    id: "vre-manassas-park",
    name: "Manassas Park",
    lat: 38.7657,
    lng: -77.4407,
    lines: ["Manassas"]
  },
  {
    id: "vre-manassas",
    name: "Manassas",
    lat: 38.7501,
    lng: -77.4728,
    lines: ["Manassas"]
  },
  {
    id: "vre-broad-run",
    name: "Broad Run",
    lat: 38.7295,
    lng: -77.5260,
    lines: ["Manassas"]
  }
];
