# Arcade menu polish

The home screen and race setup now use the game's existing italic Roboto, phosphor green, and signal pink more prominently. Primary buttons have a clipped corner, a sliding hover fill, and press feedback. Course cards show larger route maps in each course's own accent, with a moving highlight on the selected course. The launch label retains its arrow when switching between race and time trial.

## Motion choices

| Surface           | Change                                                                | Timing and reason                                                           |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Home title        | Underline enters with the existing intro                              | 600 ms, establishes the title once                                          |
| Primary action    | Arrow cue, hover fill, and press feedback                             | 2400 ms subtle cue, 240 ms fill, 120 ms press                               |
| Screen navigation | Directional slide and slight skew                                     | 280 ms transform, 160 ms opacity; keyboard activation remains immediate     |
| Course selection  | Map settles, status enters, highlight travels around the actual route | 240 ms settle, 180 ms status, 4 s lap; only selected visible setup animates |

The race HUD was left out of this menu pass. Continuously moving difficulty and pickup controls were rejected because they distract from selecting settings. Reduced motion disables the new movement and retains a static selected route. Hidden setup motion pauses. Existing focus rings and focus feedback remain available.

## Responsive behavior

Desktop and portrait tablet use three course cards. Phone and short landscape screens use compact rows, with setup options scrolling inside the menu and race launch controls remaining available. Short portrait screens omit the course description to make room for settings. Short landscape screens use smaller card rows. Mobile navigation through the complete setup remains covered by the existing browser tests.

## Verification

- 359 unit tests pass across 52 files; TypeScript and production build pass.
- 12 native Chromium tests pass: intro, keyboard, emulated gamepad, mobile scrolling navigation, focus, selection animation, paused hidden animation, and reduced motion.
- Final visual confirmation covers 1440×900, 390×844, 844×390, and 820×1180. Actual self-hosted fonts load, route maps remain visible, and pages have no horizontal overflow or browser errors.
- Independent code review completed; its tablet route visibility finding was corrected.
- No dependencies were added. The existing Three.js bundle-size advisory remains.
- Touch and gamepad checks use browser emulation; physical devices and production deployment were not tested.

## Navigation follow-up

Removed the decorative `/ 01` beside the logo. Back and Leave room now use the same large, borderless neon arrow with accessible names and native tooltips. Leave room sits before the room header on desktop and occupies the same masthead slot as Back on phones. The room-code panel stays in place when entering free ride.

The outgoing menu now becomes hidden immediately while the incoming menu fades and slides. This prevents overlapping titles during back navigation and rapid reversals. The setup transition test was updated from its former 240 ms expectation to the implemented 280 ms entry movement.

Follow-up verification: eight setup/menu browser tests and two local WebRTC multiplayer tests pass, including per-frame checks for overlapping screens at desktop and phone widths, room exit, and mobile free ride. TypeScript, build, and formatting pass. Final desktop and phone captures confirm the arrows have no background or border.
