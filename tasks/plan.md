# Water racing implementation

Approved direction: `gameplay-capability-map.md`. Palm remains tropical throughout.

## Outcome

A playable water racer with local sea conditions, weight-driven carving and landings, purposeful course corridors and jump sequences, and deliberate tricks with visible fall-off/remount recovery. Preserve mobile's four driving buttons, finish autopilot, fixed results, and the neon polygon aesthetic.

## Ordered slices

1. **water-field:** define a serializable wave zone profile; use the same generated parameters on the CPU and GPU. Preserve triangle interpolation. Wire every surface consumer to the course profile. Validate calm and launch zones, smooth transitions, and existing buoyancy.
2. **rider-hull:** simulation-owned body lean/compression; body loading affects bank, pitch, steering and water entry. Inside foot may leave the deck under a deep supported carve. Landings may submerge the bow and lose speed. Validate repeatability, real water-only airtime, limb reach and re-entry depth.
3. **course-layout:** put authored islands/banks/walls and collisions in course data, then render those shapes. Build Palm as lagoon → island carve → exposed wave channel → optional ramp pair → tropical lagoon. Preserve a clear bypass and gates for every jump. Apply distinct dock corridors to Port and exposed/calm contrasts to Storm. Derive AI lines and gates from the same authored route. Revise lap records for changed courses.
4. **stunt-recovery:** explicit airborne trick input and orientation, landed/failed outcomes, rider separation and remount beside the craft. No checkpoint advancement while dismounted. Keyboard E and gamepad right shoulder choose flip; steering with the trigger chooses spin. Touch uses an airborne swipe from GO: up for flip, sideways for spin; no added permanent button. A single deliberate trigger starts one rotation, whose completion requires enough airtime.
5. **race-integration:** validate AI on every route, repeated laps, all controls, help copy and minimal state feedback. Capture representative browser footage and screenshots. Keep results/restart/pause behavior working through airborne and recovery states.

## Ownership

- Water functions and shader parameters: `src/game/water.ts`, `water-material.ts`.
- Course definitions and authored boundaries: `src/game/tracks.ts`, new small course geometry modules as needed; world rendering consumes rather than mutates physics geometry.
- Physics: `src/game/physics.ts`, with rider/air/recovery state in focused modules to prevent one giant loop.
- Rider rendering: `src/game/rider-pose.ts`, `rider.ts`, `jets.ts`.
- Inputs and lifecycle: `src/game/engine.ts`, `src/touch.ts`, `src/controls.ts`, `src/main.ts`.
- Verification: `tests/` for physical invariants, `e2e/` for real input/render/lifecycle checks. Local review media in ignored `artifacts/`.

## Commands

`pnpm check`, `pnpm build`, `pnpm format:check`, and `pnpm test:browser` against the running development server.

## Boundaries and acceptance

- Preserve the fixed 120 Hz simulation and CPU/GPU water agreement. No gameplay forces derived from render-frame timing.
- All racers use the same hull and water model. AI may decline optional tricks; it must complete courses without routine teleport recovery.
- Success and failure depend on takeoff, attitude, and landing. Ordinary moderate waves should not eject the rider.
- A failed trick visibly separates the rider, costs time, and remounts near the ski. It never advances a gate. Checkpoint Reset remains separate and excludes local bests.
- Inputs cancel on blur, pause and restart. Reduced motion suppresses optional camera/motion effects while preserving required gameplay state.
- Course obstacles must not overlap intended navigation lines or ramp runouts. Both jump chains must be reachable at ordinary racing speed.
- Target a roughly two-minute lap using meaningful course sections; measure, do not fabricate the achieved timing. Preserve difficulty ordering with actual race benchmarks.
- Stop and diagnose any failed test or impossible navigation. Do not loosen physical invariants or suppress failures to declare completion.
- No push or production publication in this implementation turn.
