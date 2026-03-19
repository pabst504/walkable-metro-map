export type MarcLine = "Penn" | "Camden" | "Brunswick";

export type MarcStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: MarcLine[];
  /** ID of the WMATA station at the same location, if any */
  metroStationId?: string;
};

export const MARC_STATIONS: MarcStation[] = [
  // ── Co-located with Metro ───────────────────────────────────────────────
  {
    id: "marc-union-station",
    name: "Washington Union Station",
    lat: 38.8990,
    lng: -77.0068,
    lines: ["Penn", "Camden", "Brunswick"],
    metroStationId: "union-station"
  },
  {
    id: "marc-new-carrollton",
    name: "New Carrollton",
    lat: 38.9480,
    lng: -76.8725,
    lines: ["Penn"],
    metroStationId: "new-carrollton"
  },
  {
    id: "marc-college-park",
    name: "College Park",
    lat: 38.9780,
    lng: -76.9288,
    lines: ["Camden"],
    metroStationId: "college-park"
  },
  {
    id: "marc-greenbelt",
    name: "Greenbelt",
    lat: 39.0101,
    lng: -76.9127,
    lines: ["Camden"],
    metroStationId: "greenbelt"
  },
  {
    id: "marc-silver-spring",
    name: "Silver Spring",
    lat: 38.9927,
    lng: -77.0303,
    lines: ["Brunswick"],
    metroStationId: "silver-spring"
  },
  {
    id: "marc-rockville",
    name: "Rockville",
    lat: 39.0842,
    lng: -77.1460,
    lines: ["Brunswick"],
    metroStationId: "rockville"
  },

  // ── Penn Line standalone ────────────────────────────────────────────────
  {
    id: "marc-seabrook",
    name: "Seabrook",
    lat: 38.9733,
    lng: -76.8431,
    lines: ["Penn"]
  },
  {
    id: "marc-bowie-state",
    name: "Bowie State",
    lat: 39.0177,
    lng: -76.7651,
    lines: ["Penn"]
  },
  {
    id: "marc-odenton",
    name: "Odenton",
    lat: 39.0869,
    lng: -76.7062,
    lines: ["Penn"]
  },
  {
    id: "marc-bwi",
    name: "BWI Marshall Airport",
    lat: 39.1923,
    lng: -76.6947,
    lines: ["Penn"]
  },
  {
    id: "marc-halethorpe",
    name: "Halethorpe",
    lat: 39.2368,
    lng: -76.6915,
    lines: ["Penn"]
  },
  {
    id: "marc-west-baltimore",
    name: "West Baltimore",
    lat: 39.2934,
    lng: -76.6534,
    lines: ["Penn"]
  },
  {
    id: "marc-baltimore-penn",
    name: "Baltimore Penn Station",
    lat: 39.3072,
    lng: -76.6157,
    lines: ["Penn"]
  },
  {
    id: "marc-martin-state-airport",
    name: "Martin State Airport",
    lat: 39.3384,
    lng: -76.4193,
    lines: ["Penn"]
  },
  {
    id: "marc-edgewood",
    name: "Edgewood",
    lat: 39.4160,
    lng: -76.2928,
    lines: ["Penn"]
  },
  {
    id: "marc-aberdeen",
    name: "Aberdeen",
    lat: 39.5086,
    lng: -76.1630,
    lines: ["Penn"]
  },
  {
    id: "marc-perryville",
    name: "Perryville",
    lat: 39.5581,
    lng: -76.0738,
    lines: ["Penn"]
  },

  // ── Camden Line standalone ──────────────────────────────────────────────
  {
    id: "marc-riverdale",
    name: "Riverdale Park",
    lat: 38.9630,
    lng: -76.9350,
    lines: ["Camden"]
  },
  {
    id: "marc-muirkirk",
    name: "Muirkirk",
    lat: 39.0627,
    lng: -76.8844,
    lines: ["Camden"]
  },
  {
    id: "marc-laurel",
    name: "Laurel",
    lat: 39.1022,
    lng: -76.8419,
    lines: ["Camden"]
  },
  {
    id: "marc-laurel-racetrack",
    name: "Laurel Racetrack",
    lat: 39.1058,
    lng: -76.8339,
    lines: ["Camden"]
  },
  {
    id: "marc-savage",
    name: "Savage",
    lat: 39.1229,
    lng: -76.7964,
    lines: ["Camden"]
  },
  {
    id: "marc-jessup",
    name: "Jessup",
    lat: 39.1516,
    lng: -76.7764,
    lines: ["Camden"]
  },
  {
    id: "marc-dorsey",
    name: "Dorsey",
    lat: 39.1813,
    lng: -76.7453,
    lines: ["Camden"]
  },
  {
    id: "marc-st-denis",
    name: "St. Denis",
    lat: 39.2244,
    lng: -76.7039,
    lines: ["Camden"]
  },
  {
    id: "marc-baltimore-camden",
    name: "Baltimore Camden Station",
    lat: 39.2832,
    lng: -76.6195,
    lines: ["Camden"]
  },

  // ── Brunswick Line standalone ───────────────────────────────────────────
  {
    id: "marc-kensington",
    name: "Kensington",
    lat: 39.0268,
    lng: -77.0717,
    lines: ["Brunswick"]
  },
  {
    id: "marc-garrett-park",
    name: "Garrett Park",
    lat: 39.0390,
    lng: -77.0936,
    lines: ["Brunswick"]
  },
  {
    id: "marc-washington-grove",
    name: "Washington Grove",
    lat: 39.1364,
    lng: -77.1777,
    lines: ["Brunswick"]
  },
  {
    id: "marc-gaithersburg",
    name: "Gaithersburg",
    lat: 39.1415,
    lng: -77.1927,
    lines: ["Brunswick"]
  },
  {
    id: "marc-metropolitan-grove",
    name: "Metropolitan Grove",
    lat: 39.1497,
    lng: -77.2267,
    lines: ["Brunswick"]
  },
  {
    id: "marc-germantown",
    name: "Germantown",
    lat: 39.1734,
    lng: -77.2706,
    lines: ["Brunswick"]
  },
  {
    id: "marc-boyds",
    name: "Boyds",
    lat: 39.1842,
    lng: -77.3143,
    lines: ["Brunswick"]
  },
  {
    id: "marc-barnesville",
    name: "Barnesville",
    lat: 39.2098,
    lng: -77.3826,
    lines: ["Brunswick"]
  },
  {
    id: "marc-dickerson",
    name: "Dickerson",
    lat: 39.2200,
    lng: -77.4220,
    lines: ["Brunswick"]
  },
  {
    id: "marc-point-of-rocks",
    name: "Point of Rocks",
    lat: 39.2735,
    lng: -77.5337,
    lines: ["Brunswick"]
  },
  {
    id: "marc-monocacy",
    name: "Monocacy",
    lat: 39.3826,
    lng: -77.3944,
    lines: ["Brunswick"]
  },
  {
    id: "marc-frederick",
    name: "Frederick",
    lat: 39.4117,
    lng: -77.4052,
    lines: ["Brunswick"]
  },
  {
    id: "marc-brunswick",
    name: "Brunswick",
    lat: 39.3120,
    lng: -77.6279,
    lines: ["Brunswick"]
  },
  {
    id: "marc-harpers-ferry",
    name: "Harpers Ferry",
    lat: 39.3246,
    lng: -77.7313,
    lines: ["Brunswick"]
  },
  {
    id: "marc-duffields",
    name: "Duffields",
    lat: 39.3621,
    lng: -77.8281,
    lines: ["Brunswick"]
  },
  {
    id: "marc-martinsburg",
    name: "Martinsburg",
    lat: 39.4585,
    lng: -77.9607,
    lines: ["Brunswick"]
  }
];
