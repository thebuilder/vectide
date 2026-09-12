# Continuous stunt controls

Approved direction: retain holding and releasing the prepare button at takeoff, then let lean and steering control rotation throughout flight. Keyboard W remains throttle; Shift/C lean back/forward, A/D spin. Controller and touch use the existing two-axis stick. No stick-circle gestures or extra trick buttons.

## Behavior and boundaries

- Holding E/RB/JUMP while supported loads the rider. Releasing within the existing takeoff buffer arms full rotation for that jump; it does not launch an automatic trick. A neutral jump stays neutral.
- While armed and airborne, lean and steering accelerate bounded pitch/yaw angular velocity. Continuous holds can make multiple rotations. Acceleration is limited to 22 rad/s² across both axes, so counter-input takes about 0.31 seconds to brake a full-speed rotation before reversing. Neutral input damps angular momentum; opposite input brakes and then reverses it. A small assist settles only near upright/aligned rotation, never completes an inverted flip automatically.
- Ordinary unprepared jumps keep limited lean corrections. A forward-lean nose entry can briefly submerge the craft; entry motion determines penetration, water drag costs speed, and buoyancy restores the hull. Hard inverted/vertical entries retain recovery consequences.
- Touchdown uses actual hull orientation and relative impact. Count completed rotations on successful touchdown and give the existing bounded flip speed reward at most once. Preserve sideways landing heading and world momentum.
- Rendered orientation, hull contact samples, and contact velocity agree. Serialize all continuous stunt state, bump protocol compatibility, preserve the room discovery address.
- Update device-specific help, ramp tutorial, and exhaust/landing fixtures. Reset, pause, touch cancellation, and recovery must not create an unintended stunt.

## Implementation and verification

1. Replace timed rotations with continuous angular state, connect neutral prepare input on all devices, and test control response, buffering, multiple turns, assistance, and actual ramp landings.
2. Add and tune shallow forward entries with physics regressions for immersion, resurfacing, speed loss, and inverted/hard impact. Update player guidance.
3. Run full checks/build/format, native browser keyboard/touch/simulated-gamepad stunt flows and landing/interpolation, local WebRTC state/compatibility, and independent code review. Inspect an actual rendered stunt sequence.

This is one local gameplay change. Existing course geometry, weapons, and scenery remain outside its implementation scope.

## Completed verification

- 271 tests pass across 46 files, including real ramp front/back flips, both spin directions, prolonged holds, release/opposite braking, near-upright assistance, inverted impacts, short-airtime cleanup, water entry/resurfacing and multiplayer state transport.
- 24 native Chromium checks pass across keyboard, touch, simulated gamepad, wave takeoff/dive, near-finished/inverted landings, airborne exhaust, 60/120/144/240 Hz ramp motion, local rendered WebRTC peers, and protocol mismatch handling.
- A local host performs a continuously controlled flip while its guest receives and renders the changing orientation and successful landing. Remote stunt angles interpolate between snapshots.
- Actual water entry dipped about 0.38 m below the local surface and resurfaced without recovery. Water-launched flip completed with no direct wake impulse.
- Build, formatting and independent source/network review pass. Native rendering and touch viewport screenshots were inspected; a short actual-game clip is saved under artifacts for review. Physical controllers, physical phones and WAN multiplayer were not exercised.

## Momentum and exhaust follow-up

- Reduced normal plume length by about 53% and maximum boost length by about 65%, with narrower, dimmer emission and faster reduction to a nozzle glow in flight.
- 276 unit tests and the production build pass. Fifteen distinct native Chromium checks cover mapped stunt controls, counter-input momentum, ramp landings, wave flips/diving, airborne exhaust, real local WebRTC stunt replication, and protocol compatibility. Touch and gamepad inputs are simulated; physical devices were not exercised.
