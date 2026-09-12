# Stunt landings

Landing no longer fails because a flip or spin is between 6% and 94% complete. The craft's visible pitch and yaw become its physical orientation on touchdown. Tilt relative to the supporting water/ramp and relative impact speed determine whether the rider stays attached. Moderate imperfect entries scrub speed; spins preserve world momentum and their landed heading so ordinary handling carries them into that direction. Inverted and steep, hard entries still trigger recovery.

Stunt contact points follow the rotated hull. A single landing decision runs after rigid-deck resolution, with the deck taking precedence where water and ramp overlap. The original completed-flip reward remains limited to a completed flip. Predicting clients use protocol version 16; the room discovery prefix is unchanged.

Verification:

- New near-finished flip/spin regressions failed under the old completion cutoff.
- 247 unit/simulation tests pass, including 10/25/45-degree short flips, mirrored off-angle spins, inversion, surface slope, animation-progress independence, recovery, a single landing decision at a water/deck boundary, and full races.
- Nine Chromium tests pass for actual stunt landings, ramp motion at controlled display rates and weapon contact. A near-finished flip retained 19.20 m/s of 20 m/s and landed at about 9 degrees; a spin retained 19.09 m/s and about 20 degrees of heading error, then moved in that direction. The inverted case still ejected the rider.
- Four local WebRTC checks pass: two rendered peers drive together, and mismatched host, guest and legacy versions request a reload.
- Production build, formatting and independent review pass.
