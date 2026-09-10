# Race pickups

Add five rows of five floating pickup crates to each course. One held item per racer;
each collected crate respawns after seven seconds. Keep every row clear of ramp
approaches, decks and landings. Rank at collection determines
weighted random rewards. First place receives mostly wake emitters and some mines,
never boosts or torpedoes. The trailing third receives boosts and torpedoes only.
Middle positions receive a mix. A solo racer receives the same rewards as first place.

Items: straight and seeking torpedoes with near-direct-contact explosions; armed sea
mines dropped behind the craft; a modest jet boost; a stronger wake boost that sheds
waves; and a wide wave traveling backwards. Explosions expand as shockwaves, giving
nearby craft an upward and outward impulse once per effect. Effects expire and their
count is bounded. Projectiles collide with shores and obstacles. Finished,
disconnected, or unmounted racers cannot collect or use items.

Race setup defaults pickups on. Solo setup and the host lobby have an on/off toggle.
Guests see the host setting. The setting freezes at race preparation. Time trials and
lobby practice have no pickups. Keyboard Q, gamepad LB, and a touch USE button activate
an item on a press edge. Show the held item's name/icon and control hint in the HUD.
AI racers collect and use the same items.

Implementation order: shared item simulation and regression tests; host authority and
bounded protocol snapshots; rendering, controls and setup/HUD integration; browser QA.
Weapon waves deform the ocean grid itself; CPU buoyancy and GPU displacement use
matching crest, trough and decay formulas. No separate wave planes. The existing
fixed-step physics owns boosts and impulses. The host owns random rolls,
collection, use and hits. Guests predict movement and consume authoritative item state.

Source lives in src/game and src/multiplayer, tests in tests and e2e. Use the existing
TypeScript module style and Prettier conventions; no dependencies are required.
Commands: pnpm test, pnpm build, pnpm test:browser, pnpm test:multiplayer.
Validate row placement, respawns, rank restrictions, all item effects, single-use
activation, toggles and restart cleanup, multiplayer convergence and packet bounds.
Inspect desktop and touch rendering in Chromium. Production WAN and physical gamepad
behavior require separate validation. Preserve unrelated work and existing race rules.

Verification covers unit tests, regular Chromium checks and five multiplayer browser
checks. Coverage includes a full six-AI race with weapons, all six item types over
real local WebRTC, desktop and touch pickup collection/use, and GPU/CPU water-height
agreement. Production build, formatting and whitespace checks pass. Physical devices,
physical gamepad input and WAN/TURN behavior remain unverified.
