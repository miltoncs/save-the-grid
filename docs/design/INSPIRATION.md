# Visual and UX Inspiration

Status: Draft v0.1  
Last updated: 2026-02-19

## 1. Primary References

Two direct visual references are currently guiding design:

1. Google Maps screenshot:
   - Inspires readability, layering, zoom-driven detail reveal, and floating map controls.
2. OpenFront.io screenshot:
   - Inspires real-time strategy pacing, map-first focus, and pixelated coastline/terrain presentation.

References are for interaction and visual direction only, not brand imitation.

## 2. Core Principles Pulled from the References

1. Immediate readability at first glance.
2. Calm, low-noise map colors with clear layer hierarchy.
3. Floating controls over a map-first canvas.
4. Zoom-based detail reveal (coarse to fine as zoom increases).
5. High information density without visual clutter.
6. Real-time strategy tempo with continuous map-state pressure.
7. Pixelated map edges and tiles that remain legible at gameplay zoom levels.

## 3. Map Visual Language to Emulate

### 3.1 Palette Discipline

- Keep map colors limited and functional:
  - Water: light cyan/blue.
  - Land: muted light green.
  - Urban/settlement zones: light neutral tones.
  - Routes/lines: soft blue-gray lines.
- Use accent colors only for gameplay-critical signals (overload, unmet demand, outage risk).

### 3.1.1 Pixel Treatment (OpenFront-Inspired)

- Coastlines and major terrain transitions can use a pixel-stepped silhouette treatment.
- Pixel treatment should communicate style, not reduce readability.
- Keep pixel scale consistent (no mixed-resolution terrain artifacts).
- Preserve smooth camera motion even with pixel-art map edges.

### 3.2 Layer Hierarchy

1. Terrain and water first.
2. Towns and fixed points second.
3. Infrastructure network third.
4. Demand/alert overlays on top.

### 3.3 Line and Label Behavior

- Thin baseline lines with selective emphasis for important player-built `Line` routes.
- Avoid heavy strokes and high-contrast outlines by default.
- Show only labels relevant to current zoom level.

## 4. UI Shell Inspiration

1. Left utility rail for persistent global actions.
2. Top floating strip for mode/context chips.
3. Floating map controls at edges/corners (zoom, layers, toggles).
4. Panels should look lightweight and map-adjacent, not full-screen blocking windows.
5. Keep HUD compact so map state remains dominant during real-time play.

## 5. Interaction Patterns to Borrow

1. Pan-first navigation with smooth movement.
2. Scroll/gesture zoom with stable focal point.
3. Progressive disclosure by zoom level:
   - Far zoom: town clusters and high-level status.
   - Mid zoom: town points and major infrastructure.
   - Near zoom: local nodes, capacity, placement details, and coverage status.
4. Non-disruptive overlays that can be toggled quickly.
5. Continuous RTS-like pressure where decisions are frequent and spatially grounded.

## 6. Translation to This Game

1. Keep the map as the dominant surface in all gameplay states.
2. Use restrained map colors so powergrid alerts read instantly.
3. Keep onboarding maps visually simple with minimal overlays.
4. Use pixel-stepped coastlines/terrain transitions as a stylistic layer on top of the map readability system.
5. Preserve fast, scan-friendly real-time decision flow in all HUD layouts.
6. Distinguish manual long-distance `Line` routes from auto-generated short orthogonal town service links.

## 7. Non-Goals

1. Photorealistic rendering or texture-heavy terrain.
2. Saturated rainbow palettes for base map layers.
3. Constantly animating UI chrome that competes with operational signals.
4. Direct copying of Google Maps or OpenFront branding/layout identity/proprietary assets.
5. Pixel styling that obscures interactive boundaries or status overlays.

## 8. Suggested Token Seed (Draft)

These are approximate starting points for implementation experimentation:

- `--map-water: #8ecfe0`
- `--map-land: #b8dcc5`
- `--map-urban: #e9e7df`
- `--map-route: #7c8aa5`
- `--map-route-major: #6a7a98`
- `--alert-warning: #e7a644`
- `--alert-critical: #d9534f`
- `--alert-ok: #4fae73`

Optional pixel-edge accents:

- `--map-coast-pixel-edge: #6f8ff0`
- `--map-powergrid-pixel-edge: #7fa2ff`
