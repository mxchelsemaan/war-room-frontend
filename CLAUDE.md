# CLAUDE.md

## Commands

```bash
npm run dev      # Dev server (Vite) at http://localhost:5173
npm run build    # tsc + vite build
npm run lint     # ESLint
npm run test     # Vitest (jsdom) — unit + component tests
```

## Stack

- **Vite 6** + **React 19** + **TypeScript** — entry: `index.html` → `src/main.tsx` → `src/App.tsx`
- **Tailwind v4** via `@tailwindcss/vite` — theme CSS vars in `src/index.css`, no config file
- **shadcn/ui** (New York style, Lucide icons, CSS vars) — components in `src/components/ui/`
- **MapLibre GL** + **react-map-gl** — tile style: `https://tiles.openfreemap.org/styles/dark`
- **deck.gl 9** — `HeatmapLayer` via `MapboxOverlay` added as map control
- **Path alias**: `@/*` → `src/*`

## Architecture

`src/App.tsx` renders a full-screen `<AtlasView />`. All app state lives in `AtlasView`:

- **Filters** (`AtlasFilters`): `selectedTypes: Set<string>`, `dateFrom`, `dateTo`
- **Timeline day**: single ISO date string narrowing map display
- **Layer visibility**: `{ terrain, markers, heatmap, rivers }` — passed to `AtlasMap`

**Layout** (three-column, all collapsible):
```
FilterSidebar | AtlasMap + AISummaryCard (floating) + TimelineScrubber (floating) | EventFeedPanel
```

No SSR — AtlasMap imported directly (no lazy loading needed).

### Key files

| File | Purpose |
|------|---------|
| `src/components/atlas/AtlasView.tsx` | Root: filter state, event filtering/grouping logic |
| `src/components/atlas/AtlasMap.tsx` | MapLibre map, deck.gl heatmap, emoji markers |
| `src/components/atlas/MapLayerControls.tsx` | Floating layer toggles (terrain, markers, heatmap, rivers) |
| `src/components/atlas/UnitLayer.tsx` | Military unit markers |
| `src/components/atlas/UnitLegend.tsx` | Unit faction legend |
| `src/components/atlas/FilterSidebar.tsx` | Event type checkboxes + date picker, collapsible |
| `src/components/atlas/EventFeedPanel.tsx` | Scrollable event list grouped by date, collapsible |
| `src/components/atlas/TimelineScrubber.tsx` | Floating timeline slider + play/loop/speed controls |
| `src/components/atlas/AISummaryCard.tsx` | Floating tabbed AI briefing card (static mock text) |
| `src/components/ui/DatePicker.tsx` | Multi-mode: single / range / quick presets |
| `src/data/index.ts` | `MapEvent`, `EventType`, `EventLocation` types + mock data |
| `src/data/overlays.ts` | GeoJSON: `frontLines` (LineString), `territoryZones` (Polygon), `LEBANON_RIVERS` |
| `src/data/staticMarkers.ts` | Static POI markers |
| `src/data/governorates.ts` | Lebanese governorate boundaries |
| `src/lib/datePresets.ts` | 8 preset date range helpers |
| `src/index.css` | Tailwind v4 theme, font imports, MapLibre dark bg override |

### Data model

```ts
MapEvent {
  id: number;
  event_type: string;          // e.g. "security_incident"
  event_icon: string;          // emoji
  event_label: string;
  event_location: { name: string; lat: number; lng: number };
  event_count: number;
  date: string;                // ISO yyyy-MM-dd
}
```

### Terrain

AWS Terrain Tiles (terrarium encoding), no API key required. Toggled via `LayerVisibility.terrain`.

### Supabase (planned)

Not yet wired in. When added:
- Client: `src/lib/supabase.ts` — reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Hook: `src/hooks/useEvents.ts` — replace mock data in `AtlasView`

## Testing

### Unit / component tests — Vitest

```bash
npm run test
```

- Config: `vitest.config.ts` — jsdom environment, setup via `src/test/setup.ts`
- Tests live in `__tests__/` next to source files
- Existing tests: `TimelineScrubber.test.tsx`, `src/data/__tests__/overlays.test.ts`

### Visual / E2E — Playwright (MCP)

Use the `mcp__playwright__*` tools to take screenshots and verify UI:

```
# Start dev server first, then use playwright MCP:
mcp__playwright__browser_navigate  →  http://localhost:5173
mcp__playwright__browser_take_screenshot
mcp__playwright__browser_snapshot   # accessibility tree
```

The MCP server manages browsers.
