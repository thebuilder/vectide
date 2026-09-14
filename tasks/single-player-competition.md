# Single-player competition

Offline races now put the player sixth, behind the five opponents. Racer identity stays separate from grid position, so colors, controls, and item ownership keep their existing IDs. Resetting before the first checkpoint returns each racer to the assigned grid slot. Opening-grid position uses distance along the start gate so the adjacent return stretch cannot give the wrong HUD rank. Time-trial and multiplayer grids retain their original behavior.

NOVA and ECHO already had a capped 12% catch-up power allowance, but their normal target-speed braking largely cancelled it. The same allowance now feeds both the physical engine and AI target pace. At full catch-up on Normal, their cruise target rises by 3 m/s and their corner slowdown blends toward the existing Expert setting. Easy and Expert receive a smaller 1 m/s adjustment. The allowance fades as they close the gap, applies only when behind, and stops after either racer finishes. The player and the other three opponents receive no catch-up allowance.

Offline race records use a new `race-v2` namespace because grid placement and opponent pressure changed. Time-trial and online record keys, multiplayer racer data, and protocol remain unchanged.

## Verification

TypeScript, production build, and all 395 unit tests pass. Four regression cases fail against the previous physics implementation and pass after the change. Three-lap simulations on all courses finish with no recoveries; the closest designated rival finishes 3.9–5.6 seconds from an Expert-controlled player. With an eight-second head start on Port, the winning margin falls from 13.27 seconds without assistance to 5.15 seconds with it. The simulation includes racer collisions and excludes items to isolate opponent pace.

The browser grid check verifies all three courses, player identity, rear-grid reset, and unchanged solo trial placement. The final native Chromium/Metal run starts through the actual menu controls, shows sixth place, and completes all three Port laps. The player finishes in 173.20 s and the designated rivals in 177.16/177.63 s, with zero crashes across all six racers and no resets. Only the two designated rivals receive extra power, reaching 9.79% and 12%; the other racers stay at baseline. The additional explicit browser crash assertion was verified against the captured final result. Physical controller/touch play and online sessions are not retested for this change.
