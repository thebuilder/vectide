# Palm, Port, and Storm course flow

Palm's old approach doubled back before the reef, while Port's five gates allowed direct lines across two intended basin turns. Pickup rows could sit away from those practical approaches.

Palm now sweeps from Crescent turn toward a relocated reef entrance. The nearby headland and lookout shore move outward, and the wave channel moves slightly south and rotates to meet the settled approach. The banks beneath the decorative arch extend around both tower bases, with the actual mesh footprints supported on dry land and a clear water passage between them. The outer reef gate moves onto the sheltered run. Its full opening and a settling approach are outside the authored reef wave zone; easy, normal, and expert simulated riders have been back on the water for four to five seconds before crossing it. The post-reef pickup row stays before the jump straight, and the other affected rows follow the revised approach and home straight.

Port gains Inner basin and Southwest basin checkpoints, bringing its count to seven. Both new gates face the incoming leg rather than the next turn. A cross-quay closes the misleading channel straight ahead after Inner basin, with three large left-pointing chevrons visible above the quay on approach. The intended left turn and centerline remain clear. Pickup rows move onto the approaches required by the new gates, and the swell row uses six-metre spacing to cover the faster racing line while keeping clear of checkpoints.

Storm's grid, start gate, and first checkpoint now share one straight heading. The first checkpoint moves ahead of the wave bend, with a short straight run-out before turning. The departure shelter follows this heading, and the west wave train starts farther along the bend. All twelve grid slots can cross the opening gates using throttle without steering; the wave challenge remains after the first checkpoint.

Palm, Port, and Storm best-time keys advance because previous laps are no longer comparable. The multiplayer protocol advances to 26 so host and client course geometry must match, while the room discovery prefix stays stable.

## Verification

- TypeScript and all 365 unit tests in 53 files pass, including normal/expert full laps, practical pickup approach clearance, gate ordering, wave exposure, and multiplayer snapshot bounds. New regressions check Port's closed false channel and visible sign, plus Storm's straight opening, sheltered gate, and all twelve starting slots at three wave phases.
- Production build passes with the existing Three.js chunk-size advisory.
- Native Chromium using Metal completed real six-racer laps: Palm 60.80 s and Port 63.45 s. Both visited every gate with zero missed-gate retries, recoveries, rider ejections, or page errors. Both measured a 16.7 ms 95th-percentile animation frame interval.
- The existing rendered Palm time-trial regression also passes through the airborne reef section and finish. The full Palm racing lap was rerun after the final arch-bank adjustment.
- After the Port cross-quay and Storm opening changes, both complete native Chromium/Metal racing laps pass with every checkpoint visited and no crashes or recoveries. Port completed in 63.125 s with no retries and a 16.7 ms 95th-percentile frame interval. The before/after approaches and final rendered racing screenshots were visually inspected.
- Course screenshots and a before/after geometry map were visually inspected. Independent code review found no remaining issues after updating old Palm timing assumptions and separating global wire bounds from track-specific receiver bounds in the multiplayer tests.

Pickup reach checks measure horizontal distance along normal/expert simulated lines; collection still depends on height, timing, and item availability. Live multiplayer and physical touch/gamepad play were not retested for this layout change. This work adjusts course flow; it does not change wave-impact physics or establish the cause of the separately reported side-on wave jolt.
