# 2D Overhead Map Design

Status: Draft v0.1  
Last updated: 2026-02-12

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

## 2. Map Representation Model

Recommended model: layered 2D region map with node-link infrastructure.

Layers:

1. Base terrain and geography.
2. Region boundaries and district demand overlays.
3. Infrastructure nodes (plants, substations, storage).
4. Transmission links and flow direction effects.
5. Alerts, events, and objective overlays.

This keeps routing legible without deep electrical simulation complexity.

Map content strategy:

1. V1 uses handcrafted maps only.
2. Procedural map generation is a post-v1 initiative after balance criteria are defined.

## 3. Region and District Design

Initial target:

1. 6-8 regions.
2. Each region includes 2-4 demand districts.
3. District archetypes:
   - Urban core: high demand, high growth.
   - Industrial belt: volatile demand spikes.
   - Rural cluster: broad coverage, low density.
   - Coastal corridor: moderate demand with storm vulnerability.

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
2. Keep selectable hit areas larger than visual icons.
3. Distinguish district demand from infrastructure status with separate visual channels.
4. At max zoom-out, preserve only critical signals (demand deficits, overload clusters, objectives).

## 8. Zoom-Level Detail Rules

Different zoom levels should present different levels of detail, similar to Google Maps default view behavior.

1. Far zoom (national view):
   - Show region boundaries, major transmission trunks, high-level deficits, and active critical alerts.
2. Mid zoom (regional view):
   - Show district demand overlays, key substations, and major incidents.
3. Near zoom (local view):
   - Show node slots, placement previews, local capacity stats, and fine routing details.

At every zoom level, hide non-essential detail before reducing legibility of critical signals.

## 9. Mission and Mode Interaction with Map

1. Standard Run: handcrafted map with dynamic demand/event sequences.
2. Campaign Missions: handcrafted curated map states and scripted hotspot pressures.
3. Custom Game: handcrafted map selection plus modifier-driven conditions.

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
