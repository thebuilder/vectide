# Vectide

A desktop and mobile water racer built with Three.js, TypeScript, and Vite. Race five AI riders over three laps, or ride a one-lap time trial. The interface uses the Afterglow palette and square terminal controls.

## Run

```sh
pnpm install
pnpm dev
```

Open the local address printed by Vite. Enable hardware acceleration in your browser. Keyboard, standard gamepad, and multitouch driving are supported. On phones, use the virtual arrow buttons to steer, GO for throttle, BRAKE to slow down. RESET appears after a missed gate, when far off course, or after holding GO while stuck for two seconds. Pause is at the top right. Portrait menus scroll; landscape keeps the driving view clear.

```sh
pnpm check
pnpm build
```

## Ride

| Control | Action |
| --- | --- |
| W / Up | Throttle |
| A, D / Left, Right | Steer |
| S / Down / Space | Brake |
| Shift / C | Shift weight back / forward |
| E / steer + E | Hold to load flip / spin; release at takeoff |
| Gamepad RB / stick + RB | Hold to load flip / spin; release at takeoff |
| Swipe up / sideways from GO | Swipe and hold to load flip / spin; lift at takeoff |
| R | Reset to the last passed checkpoint; resume immediately |
| Escape | Pause or resume |
| Gamepad left stick | Steer; pull back to lift the nose |
| Gamepad right / left trigger | Throttle / brake |
| Gamepad X (west face button) | Reset to the last checkpoint |
| Gamepad Start / Menu | Pause or resume |
| Arrows / WASD / D-pad / left stick | Navigate menus |
| Enter / Space / gamepad A | Select focused control |
| Gamepad B | Back or close dialog |

Pass between both buoys at each gate, in order and in the forward direction. The amber marker, HUD arrow, and minimap identify the next gate. Only the next two gates are shown, with the finish gantry also visible on the final approach. Cutting across the course does not advance checkpoints. Manual reset does not advance a checkpoint, and reset runs cannot set a local best. Best laps are stored locally, separately for each course and mode.

## Courses

- **Palm Circuit**: rolling swells, palm islands, a coastal arch, and a sweeping approach to the checkered finish.
- **Port Afterdark**: choppy water, narrow docks, cranes, and a container carrier.
- **Storm Signal**: heavy swell, offshore turbines, angular mountains, and a signal platform.

Each course has 24 gates and a pair of linked optional ramps. Palm also has a smaller opening ramp. Normal AI solo laps are approximately 115, 120, and 146 seconds. Race traffic and waves change lap times. Easy, Normal, and Expert change opponent pace; player handling stays consistent. Normal uses full throttle on open water and firmer braking in tight turns, while Expert carries more pace on calm courses and manages rough-water turns more conservatively. Top speed is approximately 80 km/h.

## Water and handling

`src/game/water.ts` owns three directional wave components and a four-meter world-space grid. Localized sheltered bays and directional swell zones modify the shared water field. The water vertex shader uses those same components and zones. The CPU interpolates the same mesh triangles rather than sampling a different smooth surface.

`src/game/physics.ts` advances at 120 fixed steps per second. Four hull contact points apply buoyancy and damping relative to the moving surface. Their force differences drive pitch and roll. Thrust, quadratic drag, lateral resistance, and steering depend on water contact. Speed adds planing lift. The rendered wave slopes also apply a gentle downhill horizontal force and yaw influence while the hull is in the water; cross-swells require small steering corrections. Closed wedge ramps extend their slope four meters below the surface and use rigid deck contact, hold the keel above their surface, and supply slope-based takeoff velocity. Ramp contact does not emit water spray. Swept side and rear wall collisions bounce riders away below deck height, while airborne riders can clear those faces. Airborne craft follow gravity without engine thrust.

This is an arcade model inspired by Wave Race's feel, not a reconstruction of Nintendo's source or a full fluid solver. The tuning keeps turns responsive while making rough water, landings, and loss of contact affect control.

Racers use equal-mass contact impulses and positional separation. Scenery collision volumes match the broad footprint of the visible objects. AI riders use the same hull simulation, brake into turns, and avoid nearby riders. Only Nova and Echo receive catch-up assistance when behind: up to 12 percent additional engine power. There is no position jump associated with catch-up. A stuck opponent can use the same immediate recovery mechanism.

## Rendering

The world, riders, and jet skis are procedural geometry. Static scenery is batched by material. The detailed water grid follows the rider in whole grid cells; a distant water plane fills the horizon. The water uses faceted shading, crest foam, and reflections without tile outlines. Instanced water cubes spray from the hull, fan out during turns, and burst on landings before settling into foam. Bloom, faceted lighting, wire edges, and a striped sun establish the visual style without downloaded textures or model services.

The rider has articulated knees and elbows, a padded racing vest, a full-face helmet, gloves, and boots. Hull acceleration and landing impacts drive leg compression; steering moves the hips and torso into the turn. Shift explicitly shifts the hips back and leans the torso rearward while keeping limb contacts attached. The torso counteracts hull pitch to keep the stance upright. Contact constraints keep the torso within limb reach before two-bone inverse kinematics places each joint. Stable bone frames prevent shin guards from twisting when a leg crosses vertical. Hands follow the steering grips. Deep wet carves extend the inside foot toward the water, while rider loading changes hull balance. Hard landings can bury the hull before buoyancy recovers it.

Load a trick by holding E or gamepad RB on the approach, then release near takeoff. Steering selects a spin. Releases up to 300 ms before takeoff are buffered; earlier releases cancel. Holding visibly crouches the rider. Flips and spins need enough airtime to finish. Landing a completed flip adds 10 percent to horizontal speed, capped at 2 m/s, once per landing. An unfinished trick throws the rider off; the rider falls, swims back beside the craft, and climbs aboard. Checkpoints cannot advance while detached. Ordinary jumps remain forgiving.

The close chase camera follows horizontal movement directly, maintaining its distance at speed, and stays above the wave surface. Rendering and physics have separate timing. The game pauses when focus is lost or the page is hidden. The menu shows a single floating craft with course markers hidden. Palm fronds curve and taper; sparse island clusters and varied tower silhouettes break up repeated scenery. A three-dolphin pod breaches near the first third of the course when approached, then dives away, once per lap. The menu and HUD are semantic HTML over the WebGL canvas.

## Verification

Unit and integration tests cover wave/mesh agreement, buoyancy stability in all sea states, airborne thrust, ramp takeoff and landing, directional gate admission, racer impulses, recovery, bounded catch-up, scenery clearance, and complete six-rider three-lap races on all courses without recovery.

Rider tests cover wave and landing reactions, mirrored turn lean, frame-rate consistency, extreme contact reach, stable shin orientation, and upright posture. The browser suite also measures the rendered hand and foot contact errors during rough-water riding.

The browser smoke suite uses the running local server:

```sh
pnpm test:browser
```

Browser captures are in `artifacts/`. Hardware gamepad feel and browsers beyond Chromium still need hands-on verification. Before the First Credit loops on the title screen when sound is enabled. Starting a race switches to the selected race song; returning to the title screen restores its theme. The racing soundtrack includes Apex Run, Crimson Slipstream, and Neon Slipway. Choose the starting song in the menu; songs advance in a looping playlist. Hit the Water enables audio when starting a race, and SOUND toggles music plus engine effects. Pause freezes playback. A dedicated music analyser extracts bass, mid, and treble energy with adaptive peaks and smooth decay: nearby course lights, sun scale, bloom, wave-crest highlights and reflections respond without changing collision geometry or wave physics. Reduced-motion preferences disable the additional visual modulation. Music files load on demand.

Visual references: [Afterglow](https://afterglow.thebuilder.dk/), [Vector Wars](https://github.com/thebuilder/vector-wars), [thebuilder.dk](https://github.com/thebuilder/thebuilder-dk). Gameplay reference: [MoeGamer's Wave Race 64 review](https://moegamer.net/2018/02/09/n64-essentials-wave-race-64/).
