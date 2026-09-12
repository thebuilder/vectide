# Ramp motion timing

The physics already ran at 120 Hz, but local racers rendered the latest completed step directly. Display timing variation caused repeated hull positions followed by double steps, while the camera and rider suspension continued updating every display frame.

Local races now interpolate position, orientation, velocity and rider load between completed physics steps. Water and contact effects use the same presentation clock. This adds at most one physics step (8.3 ms) of presentation delay; simulation, input, collisions, jump trajectories and race timing are unchanged. Network rendering retains its existing path. Reset/recovery discontinuities snap safely and pause holds the interpolation fraction.

Verification:

- Actual renderer, seven-second Palm ramp approach, takeoff and landing with controlled 120 Hz timing varying by 0.8 ms: 281 repeated positions before, zero after, with identical sampled physics trajectories.
- Controlled 60, 120, 144 and 240 Hz ramp runs all pass. These are synthetic frame schedules, not physical display benchmarks.
- Live browser ramp recording completes takeoff and landing; maximum hand/foot contact error is below 0.000001 units. Capture: `artifacts/ramp-motion.mp4`.
- All 231 unit/simulation tests, production build, formatting, and 12 Chromium ramp/finish/water/performance checks pass. Native six-racer frame time remains 16.7–16.8 ms p95 across all three courses.
- Independent review found no required issues.
