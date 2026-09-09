# Water racing revision: proposed capability map

Status: approved with correction: Palm Circuit remains entirely tropical; harbor architecture belongs only to Port Afterdark.

## Direction

Make the rider, hull, water, and course interact visibly and predictably. Keep the existing neon polygon style, minimal interface, common physics for opponents, and keyboard/gamepad/touch support.

The supplied 24.6-second reference montage demonstrates a deep bank near a shoreline, ramps aligned with the following run, sustained airborne maneuvers, and a landing that buries the craft beneath the surface before it emerges. It shows broad water connected to confined racing passages. These observations describe the footage, not Nintendo's internal physics implementation. A complete fall-off and remount sequence is a requested feature, not something established by the inspected frames.

## Current constraints found in the code

- `src/game/water.ts`: every location uses the same three traveling wave components; courses change a single amplitude. There are no sheltered areas or authored wave sets. Preserve the existing agreement between rendered water triangles and physical surface samples when extending this.
- `src/game/physics.ts`: four buoyancy contacts, moving-surface damping, planing lift, and airborne gravity already exist. Pitch is clamped to about 46 degrees and roll to about 52 degrees, preventing complete rotations. Lean adds pitch torque; there is no coupled rider mass or explicit landing/crash state.
- `src/game/rider-pose.ts` and `src/game/rider.ts`: the rider reacts to acceleration, but turn displacement is capped near 0.19 units. Both foot targets remain fixed on the deck. Bigger lean alone would fight the contact constraints. Rider pose currently updates at render rate, so physical body input must move into the fixed-step simulation.
- `src/game/tracks.ts`: courses are spline loops with 12 evenly distributed gates. Each gets the same two ramp placement fractions. Ramp placement is not a designed sequence of takeoff, landing, and next takeoff.
- `src/game/visuals.ts`: islands and docks are offset away from the route and rejected when they intrude on the racing corridor. Their collision data is populated during world construction. Authored navigable shorelines need course-owned geometry and collision data.
- Existing documented Normal solo laps are around 42–69 seconds. Course length should come from purposeful sections; retain the original roughly two-minute lap ambition as a design target to validate, not a reason to stretch empty straights.

## Capability map

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| water-field | A shared rendered/physical surface with smoothly blended sheltered water, directional swell corridors, and distinct launchable wave sets. | — |
| rider-hull | Fixed-step rider weight, deeper carving, inside-foot release, compression/extension, airborne attitude control, and speed-sensitive water entry. Animation follows physical state and respects limb reach. | water-field |
| course-layout | Authored islands, shoreline passages, harbor walls, gate approaches, and ramp chains. Geometry, collisions, navigation, and water zones agree. | water-field, rider-hull |
| stunt-recovery | Deliberate airborne tricks, valid landing detection, failed-trick separation, a short fall-off/remount sequence, and safe control restoration. | rider-hull |
| race-integration | AI competence, difficulty tuning, touch/gamepad/keyboard input, camera visibility, minimal feedback, and finish/restart behavior across the new mechanics. | water-field, rider-hull, course-layout, stunt-recovery |

Build order: water-field → rider-hull → one complete Palm Circuit revision → stunt-recovery → remaining courses and full race integration. Integrate and verify ordinary racing throughout; the final module owns the complete cross-system pass.

## First playable course

Use Palm Circuit to establish the feel before rebuilding all three courses:

1. Rolling start bay with a small optional ramp before the first bend.
2. A close island bend that rewards committing to a deep carve. The inside leg extends toward the surface only when the turn and water contact justify it.
3. A narrower passage opening into a directional swell field. Some crests give deliberate airtime; calmer water offers a steadier alternate line through the same checkpoint sequence.
4. A straight with two aligned ramps. The first landing leaves enough distance to settle, aim, and reach the second ramp. Both have bypass water.
5. A sheltered tropical lagoon passage between sandy islands, followed by a readable final approach. No docks, cranes, containers, or industrial harbor structures on Palm.

Later, Port Afterdark emphasizes sheltered dock turns, piers and ramp straights; Storm Signal emphasizes large exposed wave sets and relief behind breakwaters. Course geometry should explain the changing water conditions.

## Gameplay decisions proposed

- Weight matters: body movement changes hull loading and carving, then the visible rider follows that motion. Avoid a separately animated lean that has no handling consequence.
- Let a hard landing sink the bow and slow the craft before buoyancy brings it back. A brief controlled submersion is a valid outcome. It must not automatically count as a crash.
- Ordinary jumps remain forgiving. A failed deliberate trick, extreme bad landing, or sufficiently severe impact can throw the rider off; small chop must not cause repeated falls.
- Begin with a small, legible set of tricks, such as a flip and a lateral spin. Input determines rotation and the player must recover a landable attitude. Do not add a separate stunt scoreboard to the racing HUD in the first pass.
- Recovery happens near the fallen craft with a visible climb back on. It costs race time, never grants a checkpoint, and does not masquerade as a completed lap. Keep manual checkpoint Reset distinct.
- Keep the current four-button mobile driving layout. Normal carving and weight reactions are automatic on touch. Any deliberate trick gesture or contextual air control must be specified before implementation, rather than restoring an always-visible Lean button.
- Keep the current fixed-step loop and CPU/GPU surface agreement. A full fluid solver is not necessary for the proposed behavior.

## What the first review should establish

A short captured run should show a calm-water turn, deep carve with leg extension, wave-only jump, ramp-to-ramp line, visibly compressed/submerged landing, successful deliberate trick, failed trick and remount. Complete races must still finish without stuck AI or skipped checkpoints. Compare equivalent input at different render rates and verify desktop and touch views.

This map establishes module boundaries and build order. Detailed tuning, controls, acceptance thresholds, and per-module implementation tasks follow after that direction is reviewed.
