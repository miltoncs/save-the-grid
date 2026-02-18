# 2D Overhead Map Design

Status: Draft v0.1  
Last updated: 2026-02-18

Reference: See `INSPIRATION.md` for map visual language, hierarchy, and zoom behavior targets.

## 1. Perspective and Camera

The game uses a 2D overhead map only.

Camera behavior:

1. Pan across country map via mouse drag or edge pan.
2. Zoom through 3-5 discrete levels.
3. Keep UI overlays anchored and readable at all zoom levels.

No isometric or 3D camera modes are in scope.

Visual direction:

1. Flat, clean 2D rendering.
2. Minimal gradients.
3. No photorealistic terrain or textures.
4. Small functional palette similar to Google Maps default-view readability (land/water/biome differentiation).
5. Optional pixel-stepped coastlines/region borders inspired by OpenFront-style map silhouettes.

## 2. Map Representation Model

Recommended model: layered 2D map board with point-of-interest icons and lightweight network overlays.

Layers:

1. Game board layer (always visible): land/water plus land type (mountain, desert, plains).
2. Civilization layer: towns shown as point icons.
3. Power grid layer: power stations/substations shown as point icons, with transmission links shown as connectors.
4. Resource layer: natural resource zones, hidden by default and revealed while holding `R`.
5. Alerts/objective layer: incidents, demand deficits, and mission markers.

This keeps routing legible without deep electrical simulation complexity.

Map content strategy:

1. V1 uses handcrafted maps only.
2. Procedural map generation is a post-v1 initiative after balance criteria are defined.
3. Map progression scales from small fully-open layouts to large fragmented regional layouts.
4. Basic levels start mostly empty: mostly terrain, a few seeded towns, and little to no prebuilt power-grid infrastructure.

### 2.1 Town Seeding and Emergence

1. Runs begin with a small number of seeded towns for immediate priorities.
2. Additional towns can emerge during a run when local conditions are favorable.
3. Emergence requirements:
   - Livable terrain only (not mountains or ocean tiles).
   - Region must be unlocked.
   - Nearby grid service must be stable (no sustained outage state).
4. New towns start at low demand and then follow normal demand growth rules.
5. Tutorial/onboarding maps can cap or disable emergence until core controls are learned.

## 3. Region and District Design

Initial target:

1. 6-8 regions.
2. Each region includes 2-4 demand districts.
3. District archetypes:
   - Urban core: high demand, high growth.
   - Industrial belt: volatile demand spikes.
   - Rural cluster: broad coverage, low density.
   - Coastal corridor: moderate demand with storm vulnerability.

District data includes a simple population value used for demand scaling when growth is enabled.
Districts/regions also include a climate tag used for seasonal demand modifiers when enabled.

### 3.2 Map Scale and Fragmentation Progression

- Early levels:
  - Small maps with fewer regions and all core areas unlocked.
  - Designed for immediate readability and low camera-management burden.
- Mid levels:
  - Medium maps with selective locked regions.
  - Introduce expansion timing decisions.
- Late levels:
  - Large maps with fragmented region groups.
  - Require planned region acquisition to reach full-map control.

### 3.3 Region Unlock Rules

- Locked regions cannot be built on or routed through until purchased.
- Region purchase cost is paid from current-level budget.
- Unlocking a region activates new demand obligations and potential risk exposure.
- Region unlock previews must show cost, expected demand load, and strategic value.
- Region unlock spending does not carry forward to the next level.

### 3.1 Seasonal and Regional Demand Modifiers

- Regions carry simple climate categories (cold, temperate, warm).
- Season state modifies demand by climate category.
- Example effects:
  - Cold + winter: higher heating-related demand.
  - Warm + summer: higher cooling-related demand.
- Modifiers should be clearly surfaced and easy to reason about.
- Tutorials/early onboarding maps can run in `Neutral` seasonal mode with these modifiers disabled.

## 4. Terrain Effects (Shallow Simulation)

Terrain modifies build cost and reliability risk, not full physics.

Examples:

1. Plains: baseline costs.
2. Mountains: higher transmission build cost.
3. River crossings: additional upfront line cost.
4. Coastline: elevated storm incident chance.

Terrain effects should be visible and explainable in tooltips.

## 5. Infrastructure Placement Rules

1. Plants and substations place on valid node slots.
2. Transmission links connect compatible node types.
3. Storage assets attach to substation clusters.
4. Demolition has a short cooldown on rebuild at same slot to prevent spam loops.

Placement preview should always show:

1. Cost.
2. Capacity change.
3. Local reliability impact.

## 6. Routing and Flow Visualization

Flow clarity is a core map requirement.

Visualization rules:

1. Line thickness represents capacity.
2. Pulse speed/intensity indicates utilization.
3. Color state indicates stress:
   - Normal.
   - Warning.
   - Overloaded.
4. Unserved districts display a subtle hatch warning overlay.

## 7. Map Readability Rules

1. Do not let decorative terrain hide operational information.
2. Distinguish district demand from infrastructure status with separate visual channels.
3. At max zoom-out, preserve only critical signals (demand deficits, overload clusters, objectives).
4. If pixel-edge styling is used, gameplay boundaries must still be unambiguous at all zoom levels.

## 8. Zoom-Level Detail Rules

Different zoom levels should present different levels of detail, similar to Google Maps default view behavior.

Point icon scale target:

- Standard map zoom uses small point icons around 20x20 px for towns and power-grid nodes.

1. Far zoom (national view):
   - Show game-board terrain classes, region boundaries, major transmission trunks, high-level deficits, active critical alerts, and current season state.
   - Collapse point icons into minimal markers to avoid clutter.
2. Mid zoom (regional view):
   - Show town and power-station point icons at standard size.
   - Show district demand overlays, key substations, major incidents, population pressure hotspots, and climate-pressure hotspots.
3. Near zoom (local view):
   - Show node slots, placement previews, local capacity stats, fine routing details, district growth trend markers, and local seasonal demand contributors.
   - Show richer labels/tooltips for nearby town and station points.

Resource layer visibility:

- Resource zones remain hidden unless the player is holding `R`.
- Releasing `R` returns the map to normal operational layers.

At every zoom level, hide non-essential detail before reducing legibility of critical signals.

## 9. Mission and Mode Interaction with Map

1. Standard Run: handcrafted map with dynamic demand/event sequences.
2. Campaign Missions: handcrafted curated map states with deliberate map-size progression and fragmented-region unlock flow.
3. Custom Game: handcrafted map selection plus population/season/condition modifiers.

All modes should share the same base map interaction vocabulary.

## 10. Example Starter Map Blueprint

1. Central capital metro region (high baseline demand).
2. North industrial spine (fast growth, high load volatility).
3. West hydro corridor (cheap clean generation with drought risk events).
4. East coast trade line (storm-prone transmission zone).
5. South agricultural grid (coverage-heavy, lower density).
6. Frontier expansion belt (late-run growth pressure).

## 11. Technical Constraints for Later Architecture

1. Separate data layer (graph state) from visual layer (sprites/overlays).
2. Keep deterministic update ticks for routing and demand.
3. Store map as authored map ID + metadata, with room for future seed-based generation.
4. Ensure map interactions are input-device agnostic (mouse and touch).

## 12. Open Questions

1. Number of handcrafted maps at launch (1, 2, or 3).
2. Maximum practical node/link count before readability drops.
3. How aggressive event overlays should be at high zoom-out.
