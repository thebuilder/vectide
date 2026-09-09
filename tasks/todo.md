# Water racing revision

- [x] Shared localized water field and surface parity checks
- [x] Fixed-step rider loading, deep carving and landing compression
- [x] Tropical Palm course and ramp chain
- [x] Distinct Port and Storm layouts with matching authored collision data
- [x] Air tricks, failed landing, fall-off and remount
- [x] Keyboard, gamepad and four-button touch integration
- [x] AI complete-race and difficulty verification
- [x] Browser visual and interaction verification, documentation

## Verification — 2026-09-09

- `pnpm check`: 104 tests passed across 20 files.
- `pnpm build` and `pnpm format:check`: passed. Vite retains its Three.js chunk-size advisory.
- Browser suite: 13 initial passes; two tests interrupted by live reload passed when rerun after edits settled.
- Browser screenshots inspected for Palm opening rollers/ramp and detached swimming rider. Actual keyboard input exercised falling, swimming and remounting with no page errors.
- Touch driving and simulated gamepad lifecycle passed browser tests. Physical phone/gamepad trick gestures remain untested.
- Restored spectrum bars with terrain clearance, reduced mountain repetition, added Palm opening rollers, optional small ramp, turn chevrons and shoreline-aware gate placement.
- Final refinements: hold/release takeoff tricks, clean-flip speed reward, bank-dependent foot placement, sand-colored beat wires, and updated controls/help.
