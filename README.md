# Walkable Metro Map

Next.js app for exploring all 98 WMATA Metrorail stations in the DC, Maryland, and Virginia region on an interactive map.

## Features

- All current WMATA Metrorail stations included in a local dataset
- Click map markers or use the station list to select and deselect stations
- 5-minute and 15-minute walking polygons
- OpenRouteService-backed street-network isochrones when `OPENROUTESERVICE_API_KEY` is set
- Generated fallback walk buffers when no API key is configured

## Run locally

```bash
npm install
npm run dev
```

Optional:

```bash
cp .env.example .env.local
```

Then set `OPENROUTESERVICE_API_KEY` in `.env.local` for real network-based walking sheds.
