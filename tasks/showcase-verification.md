# Showcase polish verification — 12 September 2026

Branch `feat/showcase-polish` started from `origin/main` f960c15.

## Delivered behavior

- The approved 1672×940 artwork is `public/og.png`, with matching social metadata and an asset test. The obsolete procedural cover generator is removed.
- Amber camera-facing double chevrons bob above the active gate. A backed HUD badge projects toward the gate and clips to safe screen bounds, including gates behind the camera. Touch portrait/landscape and reduced motion are covered.
- Current-device driving tips progress after successful inputs and remember dismissal. Help opens at its heading, advanced controls are collapsed, and pause exposes Controls. Start Race stays visible while compact setup options scroll; difficulty explains opponent pace.
- Darker teal water, restrained highlights and a burgundy Palm horizon follow the artwork. The initial two-line wake was rejected by the user and replaced with a filled, irregular foam trail plus fuller angular spray. Old foam fades after takeoff, with no connection across the airborne path. Landing compression and the finish camera beat respect reduced motion.
- Finishing plays a short sting, preserves autopilot/splits, reports the saved-best delta, and retains immediate replay. Recovered runs remain excluded from records.

## Evidence

- `pnpm check`: 210 tests across 38 files, including complete three-lap six-rider simulations on every course, pickup races, twelve-rider simulation, wave agreement, wake expiry/discontinuities/capacity, and camera motion.
- `pnpm build` and `pnpm format:check`: pass. Vite retains its existing large Three.js chunk advisory.
- Chromium suite: all 52 cases covered successfully across the full run and focused reruns. The final broad run passed 51; its remaining navigation lap completed in 84 seconds under random weapon traffic and failed an unrelated 75-second pace limit. That navigation test now uses time trial and passed its full lap and every-frame bounds checks. The separate course-variety tests retain six-rider races with pickups and pass on all courses.
- Final fuller-foam change: all seven focused Chromium cases pass (three-course rendering/performance, full Palm lap with airborne section, three weapon-water/splash checks). Captured motion includes acceleration, sustained turns, airborne intervals and four landings.
- Local WebRTC: all 12 browser tests pass, covering two rendered racers, twelve connected racers, room capacity, late joins, practice, item ownership, finish/replay, host departure, connection errors, invitations and protocol mismatches.
- WebKit: three touch setup/rotation cases and a phone-sized rendering case pass. This is desktop WebKit with mobile emulation, not a physical iPhone.
- Native Chromium/Metal at 1280×800: approximately 16.7 ms median / 16.8 ms p95 on each course with six racers and about 630–1,200 active spray fragments. The hardware profile asserts p95 below 34 ms. These measurements do not establish physical-phone performance.
- Independent code review identified redundant wake sampling/allocation. Indexed geometry now computes four unique vertices per point (maximum 3,456 samples), uses direct typed-array writes, and retains one wake draw call. The reviewer rechecked the final filled-band topology, airborne gaps and spray changes and reported no remaining required issue.

Existing test assumptions were corrected: Storm's starting heading is checked against its actual gate tangent, description matching ignores capitalization, and the frozen weapon fixture distinguishes one-shot audio from the continuous water loop and resumes its audio bus before detonation.

Captures are retained in ignored `artifacts/`, including `foam-straight.png`, `foam-carving.png`, `foam-in-motion.webm`, course renders and phone checkpoint/setup images. The capture uses the real renderer, physics and AI driver; it is silent.

## Remaining external checks

Physical-phone performance and feel, a hardware controller, first-time human playtesting, headphone/speaker balance, and separate-device/network WebRTC behavior were not verified here. Production deployment and form submission are outside this change. The cover is promotional artwork, not a gameplay screenshot.
