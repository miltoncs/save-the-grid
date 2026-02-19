# 2D Overhead Map Design

Status: Draft v0.1  
Last updated: 2026-02-19

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
5. Optional pixel-stepped coastlines and terrain-edge accents inspired by OpenFront-style silhouettes.

## 2. Map Representation Model

Recommended model: layered 2D map board with point-of-interest icons and lightweight network overlays.

Layers:

1. Game board layer (always visible): land/water plus land type (mountain, desert, plains).
2. Civilization layer: towns shown as point icons.
3. Grid asset layer: power plants and substations shown as point icons.
4. Player-built `Line` layer: manual long-distance power lines between plants and substations.
5. Resource layer: natural resource zones, hidden by default and revealed while holding `R`.
6. Alerts/objective layer: incidents, demand deficits, and mission markers.

This keeps routing legible without deep electrical simulation complexity.

Map content strategy:

1. V1 uses handcrafted maps only.
2. Procedural map generation is a post-v1 initiative after balance criteria are defined.
3. Map progression scales from small fully visible layouts to larger layouts with longer routing distances.
4. Basic levels start mostly empty: mostly terrain, a few seeded towns, and little to no prebuilt power-grid infrastructure.

### 2.1 Town Seeding and Emergence

1. Runs begin with a small number of seeded towns for immediate priorities.
2. Additional towns can emerge during a run when local conditions are favorable.
3. Emergence requirements:
   - Livable terrain only (not mountains or ocean tiles).
   - Nearby powered coverage must be stable.
4. New towns start at low demand and then follow normal demand growth rules.
5. Tutorial/onboarding maps can cap or disable emergence until core controls are learned.

## 3. Town and Coverage Design

Initial target:

1. Multiple town archetypes with distinct demand behavior (for example metro, industrial, rural, coastal).
2. Towns carry lightweight population values for demand scaling when growth is enabled.
3. Town locations and growth opportunities are authored per map for readability and balance.

### 3.1 Map Scale Progression

- Early levels:
  - Small maps with fewer towns and low camera-management burden.
  - Designed for immediate readability and quick control learning.
- Mid levels:
  - Medium maps with more separated town clusters.
  - Introduce stronger long-distance line planning.
- Late levels:
  - Large maps with high town count and terrain-constrained routing.
  - Require deliberate backbone planning and reliability management.

### 3.2 Substation Coverage and Auto-Links

- Substations power all towns within their service radius.
- When a powered substation has a town in range, a small auto-generated orthogonal service line is drawn between them.
- Auto-generated service lines are visual indicators of local town service and are not manually routed.
- Loss of substation power or range removes/invalidates that town service link until coverage is restored.

### 3.3 Seasonal and Local-Climate Demand Modifiers

- Map areas carry simple climate categories (cold, temperate, warm).
- Season state modifies town demand by local climate category.
- Example effects:
  - Cold + winter: higher heating-related demand.
  - Warm + summer: higher cooling-related demand.
- Modifiers should be clearly surfaced and easy to reason about.
- Tutorials/early onboarding maps can run in `Neutral` seasonal mode with these modifiers disabled.

## 4. Terrain Effects (Shallow Simulation)

Terrain modifies build cost and reliability risk, not full physics.

Examples:

1. Plains: baseline costs.
2. Mountains: higher `Line` construction cost.
3. River crossings: additional upfront `Line` cost.
4. Coastline: elevated storm incident chance.

Terrain effects should be visible and explainable in tooltips.

## 5. Infrastructure Placement and Line Rules

1. Power plants and substations place on valid map slots.
2. `Line` tool creates manual long-distance links between allowed endpoint pairs:
   - plant to plant,
   - plant to substation,
   - substation to substation,
   - substation to plant.
3. Storage assets attach to plant/substation clusters.
4. Demolition has a short cooldown on rebuild at same slot to prevent spam loops.

Placement preview should always show:

1. Cost.
2. Capacity change.
3. Local reliability impact.
4. For substations: service radius and expected town coverage count.

## 6. Routing and Flow Visualization

Flow clarity is a core map requirement.

Visualization rules:

1. Manual `Line` thickness represents capacity.
2. Pulse speed/intensity on manual `Lines` indicates utilization.
3. Manual `Line` color state indicates stress:
   - Normal.
   - Warning.
   - Overloaded.
4. Auto-generated town service lines are thinner, orthogonal, and visually distinct from manual `Lines`.
5. Unserved towns display a subtle hatch warning overlay.

## 7. Map Readability Rules

1. Do not let decorative terrain hide operational information.
2. Distinguish town demand, manual `Line` stress, and auto-link service state with separate visual channels.
3. At max zoom-out, preserve only critical signals (demand deficits, overload clusters, objectives).
4. If pixel-edge styling is used, gameplay boundaries must still be unambiguous at all zoom levels.

## 8. Zoom-Level Detail Rules

Different zoom levels should present different levels of detail, similar to Google Maps default view behavior.

Point icon scale target:

- Standard map zoom uses small point icons around 20x20 px for towns, plants, and substations.

1. Far zoom (national view):
   - Show game-board terrain classes, town clusters, major manual `Line` routes, high-level deficits, active critical alerts, and current season state.
   - Collapse point icons into minimal markers to avoid clutter.
2. Mid zoom (network view):
   - Show town, plant, and substation point icons at standard size.
   - Show manual `Line` stress states, major incidents, population pressure hotspots, and climate-pressure hotspots.
3. Near zoom (local view):
   - Show node slots, placement previews, local capacity stats, fine routing details, substation radius rings, and town growth trend markers.
   - Show richer labels/tooltips for nearby towns and grid assets.
   - Show auto-generated orthogonal town service links clearly.

Resource layer visibility:

- Resource zones remain hidden unless the player is holding `R`.
- Releasing `R` returns the map to normal operational layers.

At every zoom level, hide non-essential detail before reducing legibility of critical signals.

## 9. Mission and Mode Interaction with Map

1. Standard Run: handcrafted map with dynamic demand/event sequences.
2. Campaign Missions: handcrafted curated map states with deliberate map-size progression and line-routing goals.
3. Custom Game: handcrafted map selection plus population/season/condition modifiers.

All modes should share the same base map interaction vocabulary.

## 10. Example Starter Map Blueprint

1. Central plains with initial starter town cluster.
2. North industrial belt with volatile demand.
3. West hydro valley with low-cost clean generation and drought risk events.
4. East coast settlement chain with storm vulnerability.
5. South agricultural towns with broad coverage needs.
6. Interior frontier tiles with late-run town emergence potential.

## 11. Technical Constraints for Later Architecture

1. Separate data layer (graph state) from visual layer (sprites/overlays).
2. Keep deterministic update ticks for routing and demand.
3. Represent map as authored map ID + metadata, with room for future seed-based generation.
4. Ensure map interactions are input-device agnostic (mouse and touch).

## 12. Open Questions

1. Number of handcrafted maps at launch (1, 2, or 3).
2. Maximum practical town/node/line count before readability drops.
3. How aggressive event overlays should be at high zoom-out.
4. Whether auto-generated town service lines should be always visible or shown only on interaction.
