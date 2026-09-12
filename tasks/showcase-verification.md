# Racing polish verification, 12 September 2026

Branch `feat/showcase-polish` includes current `origin/main` f960c15.

## Delivered behavior

- The approved 1672×940 promotional artwork replaces the social preview, with matching metadata. The obsolete procedural cover generator is removed.
- Each course has five named gates including start/finish. Islands, reefs and breakwaters guard shortcuts. Gates angle into the next water section while retaining broad approaches. Eight-meter masts, pink/cyan pennants and larger amber chevrons improve distance visibility. Off-screen directions remain within phone portrait/landscape bounds. The checkpoint distance box is removed.
- Mobile setup keeps Start Race visible while course options scroll. Current-device driving tips remember progress, help starts at its heading, and Controls is available from pause.
- Faceted islands, slender palms, coastal surf, fuller foam wakes and carving spray follow the approved art direction. Music adds gentle highlights to existing water and foam. Dolphin pods approach from offshore and make short staggered breaches beside the rider.
- Riders control flips and spins throughout flight with rotational momentum. Reversing a full spin takes about 0.3 seconds to brake. Landing uses hull attitude and relative impact; successful tricks display animated names. Straight ramps are shorter, submerged markings remain under water, and airborne exhaust shrinks to a compact glow.
- Interpolated craft and rider poses smooth rendering between physics steps. Lap splits show pace changes. Finish feedback preserves autopilot and recovered-run record exclusion. Weapon shoves require water contact and nearby targets at release.
- Route-based ranking, AI missed-gate detection and recovery timing support the longer checkpoint sections. Item rows remain independent of gate count. Protocol version 24 and course record keys prevent mixing incompatible physics or old lap records.

## Final verification

- `pnpm check`: 336 tests across 50 files pass, including full six-rider three-lap simulations on all courses, pickup races, twelve-rider multiplayer simulation, gate admission/recovery, landing physics, water contact, dolphins and rendering interpolation.
- `pnpm build`: passes with the existing large Three.js chunk advisory. Formatting and `git diff --check` pass.
- Seventeen distinct native Chromium checks passed for the checkpoint redesign: full rendered laps on all courses, complete Storm guidance and phone rotation, four ramp rendering rates from 60 to 240 Hz, Storm's opening, wave flips/diving, two-client WebRTC driving, three version mismatch cases and replicated stunt controls.
- One Harbor run was interrupted by a Vite source reload returning it to the menu. Holding source steady and rerunning Harbor passed; the same run also passed Palm's full rendered lap.
- Inspected actual distant gate renders on all courses and a course overview containing the physical land outlines, gates and simulated racing lines. All nine course/difficulty simulations completed without a missed-gate retry.
- Independent reviews covered the implemented slices, including the final sparse-checkpoint AI and ranking math. No required findings remain.

Earlier slice verification also covered desktop WebKit phone setup/rotation, the full local WebRTC suite, onboarding, music, coastal water, trick text, mapped controls and weapon contact. Detailed evidence is retained in the other task documents and ignored `artifacts/` captures. These checks were run during implementation rather than repeated as one final broad suite.

## Palm island and tower bridge follow-up

- Joined Lagoon and Outer island into one continuous convex landform. Its ridge blocks the view of both later ramps from the early inner-island approach, and the former gap is no longer navigable.
- Moved the tower bridge earlier along the course and rotated its opening toward the incoming riding line. Visual supports and collision centers share the same transform. The shore-fitted Reef gate retains at least 40 meters of opening.
- Added terrain raycasts to the ramp tops, blocked-passage checks and bridge approach/support regressions. All 317 tests pass. The production build and six native browser checks pass, including a complete Palm lap, coastal rendering and four ramp display rates. Protocol mismatch checks were rerun for version 23.

## Pickup spacing and torpedo scenery follow-up

- Moved one of Palm's two finish-approach pickup rows to the stretch after the tower bridge. All five rows remain, with more than 120 meters of route distance between consecutive rows, including across the finish line.
- Normal and seeking torpedoes now collide along their traveled segment with ramp slopes, island shores, docks and obstacle supports. The earliest contact creates the existing explosion, spray and raised water wave. Fully submerged ramp noses remain passable until their slope reaches the torpedo.
- All 336 tests pass, including thin-obstacle tunneling, first-contact ordering and ramp side/rear regressions. The production build passes. Eleven native browser checks pass: a full Palm lap, six keyboard-fired scenery explosions, multiplayer item ownership and three protocol mismatch cases. Actual ramp, tower and shore explosion renders were inspected. Independent review found no required issues.

## Keyboard and gamepad menu follow-up

- Left/Right now stay in the current row; Up/Down enter the nearest row. Scrolling options retain navigation until the panel boundary instead of losing focus to fixed actions. Analog sticks use their dominant direction.
- Gamepads can reach multiplayer text fields, and keyboard users can leave volume sliders vertically while retaining native Left/Right/Home/End value controls. Typing and text-cursor movement retain their native behavior.
- A shared focus style adds a solid inner ring with a slow cyan halo pulse. The inner ring remains visible at clipped panel edges, and reduced motion retains a steady highlight.
- All 336 tests, the production build and fourteen native browser checks pass. Browser checks cover desktop row boundaries, gamepad form navigation and analog direction, keyboard sliders, phone portrait/landscape scrolling, animated/reduced-motion focus, pause controls and driving tips. Independent review found no required issues. Gamepad inputs were simulated through the browser API; physical controller feel remains unverified.

## External checks

Physical-phone performance and feel, hardware controllers, headphone/speaker balance and separate-device/network WebRTC were not verified here. Production deployment and external form submission were not performed. The cover is promotional artwork, not a gameplay screenshot.
