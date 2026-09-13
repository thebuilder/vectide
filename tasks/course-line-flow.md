# Palm and Port course flow

Palm's old approach doubled back before the reef, while Port's five gates allowed direct lines across two intended basin turns. Pickup rows could sit away from those practical approaches.

Palm now sweeps from Crescent turn toward a relocated reef entrance. The nearby headland and lookout shore move outward, and the wave channel moves slightly south and rotates to meet the settled approach. The outer reef gate moves beyond the strongest waves. The post-reef pickup row stays before the jump straight, and the other affected rows follow the revised approach and home straight.

Port gains Inner basin and Southwest basin checkpoints, bringing its count to seven. Its terrain and centerline stay the same; pickup rows move onto the approaches required by those gates.

Palm and Port best-time keys advance because previous laps are no longer comparable. The multiplayer protocol advances to 25 so host and client course geometry must match, while the room discovery prefix stays stable.

## Verification

- TypeScript and all 357 unit tests in 52 files pass, including normal/expert full laps, practical pickup approach clearance, gate ordering, wave exposure, and multiplayer snapshot bounds.
- Production build passes with the existing Three.js chunk-size advisory.
- Native Chromium using Metal completed real six-racer laps: Palm 52.48 s and Port 57.75 s. Both visited every gate with zero missed-gate retries, recoveries, rider ejections, or page errors. Both measured a 16.7 ms 95th-percentile animation frame interval.
- The existing rendered Palm time-trial regression also passes through the airborne reef section and finish.
- Course screenshots and a before/after geometry map were visually inspected. Independent code review found no remaining issues after updating old Palm timing assumptions and separating global wire bounds from track-specific receiver bounds in the multiplayer tests.

Pickup reach checks measure horizontal distance along normal/expert simulated lines; collection still depends on height, timing, and item availability. Live multiplayer and physical touch/gamepad play were not retested for this layout change. This work adjusts course flow; it does not change wave-impact physics or establish the cause of the separately reported side-on wave jolt.
