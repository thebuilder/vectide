# Vectide

A desktop and mobile water racer built with Three.js, TypeScript, and Vite. Race five AI riders over three laps, or ride a one-lap time trial. The interface uses the Afterglow palette and square terminal controls.

## Run

```sh
pnpm install
pnpm dev
```

Open the local address printed by Vite. Enable hardware acceleration in your browser. Keyboard, standard gamepad, and multitouch driving are supported. On phones, throttle is automatic. Slide the virtual stick left/right to steer and up/down to lean forward/back. Hold BRAKE to cut throttle and slow down. Hold JUMP / FLIP to prepare a flip, then release as a wave or ramp launches you. RESET appears after a missed gate, when far off course, or after getting stuck for two seconds. The pause icon is at the top right. Its menu has separate Sounds and Music sliders, with remembered levels and a curved volume response for quieter low settings. Music defaults to 60%, with headroom for pickup and item cues; the engine has its own quieter mix. Hit the Water opens course, mode and difficulty selection in the same screen. Back returns to the title while retaining selections. Compact screens allow the setup menu to scroll; landscape keeps the driving view clear.

```sh
pnpm check
pnpm build
```

## Ride

| Control                            | Action                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| W / Up                             | Throttle                                                |
| A, D / Left, Right                 | Steer                                                   |
| S / Down / Space                   | Brake                                                   |
| Shift / C                          | Shift weight back / forward                             |
| E / steer + E                      | Hold to load flip / spin; release at takeoff            |
| Gamepad RB / stick + RB            | Hold to load flip / spin; release at takeoff            |
| JUMP / FLIP (touch)                | Hold to prepare a flip; release at wave or ramp takeoff |
| Q / gamepad LB / USE (touch)       | Use the held pickup                                     |
| R                                  | Reset to the last passed checkpoint; resume immediately |
| Escape                             | Pause or resume                                         |
| Gamepad left stick                 | Steer; pull back to lift the nose                       |
| Gamepad right / left trigger       | Throttle / brake                                        |
| Gamepad X (west face button)       | Reset to the last checkpoint                            |
| Gamepad Start / Menu               | Pause or resume                                         |
| Arrows / WASD / D-pad / left stick | Navigate menus                                          |
| Enter / Space / gamepad A          | Select focused control                                  |
| Gamepad B                          | Back or close dialog                                    |

Pass between both buoys at each gate, in order and in the forward direction. Camera-facing amber double chevrons mark the next gate. Its HUD badge follows the gate and stays within the screen edges when the gate is outside the view, with explicit turn-back or turn-left/right guidance. The badge stays clear of mobile controls in both orientations; reduced motion disables its directional animation and the chevron bob. Only the next two gates are shown, with the finish gantry also visible on the final approach. Cutting across the course does not advance checkpoints. Manual reset does not advance a checkpoint, and reset runs cannot set a local best. Best laps are stored locally, separately for each course and mode.

## Multiplayer

Choose **Host** or **Join** on the title screen. Share the eight-character room
code and let 1–11 friends join. Copy shares a `https://vectide.thebuilder.dk/?join=CODE` invitation that joins the room automatically. Guests can set their name in the lobby. The lobby shows the racers lined up on the water;
everyone can change their name and craft color before starting. The host chooses the course and starts the three-lap
race. Everyone loads before the countdown. Rooms close to new racers once loading
starts. Online best laps are stored separately from solo races.

Choose **Free Ride** to practice in a shared lagoon with two ramps and a floating
boundary. It uses the same craft handling as racing, with no checkpoints, laps or
finish line. **Back to Lobby** (Escape, or gamepad B/Start) parks your craft and
restores the room settings. Names and colors stay locked while riding. The host
can change the selected course without moving practice riders; starting the race
loads everyone into a fresh grid and countdown. Floating labels identify other
players, never your own craft.

Keep the host's tab visible. Opening the race menu releases driving controls while
the race continues. A departing guest is marked disconnected. If the host leaves,
hides the tab, or stops sending updates, guests return to the menu with an
explanation. The host can use **Return to lobby** from results or the race menu
to bring everyone back together, preserving the room code, profiles, and settings.
The host can then start another race. There is no host migration or mid-race rejoining. A signaling interruption retries the PeerServer connection while existing
WebRTC racers keep playing; losing the host data connection still ends the room.

The host runs physics and validates checkpoints, collisions and finish times at
120 Hz. Guests batch sequenced controls at 20 Hz, immediately predict their own
craft, then reconcile against snapshots by replaying unacknowledged inputs.
Other racers render from a 100 ms interpolation buffer with at most 100 ms of
extrapolation. Large corrections, including recovery teleports, snap into place.
Snapshots use compact field arrays and four decimal places to stay below PeerJS's
JSON packet limit. Queues are bounded, stale commands are ignored, and stalled
controls brake after 250 ms. The host is trusted; this is private racing with
friends, not a cheat-proof competitive service.

[PeerJS](https://peerjs.com/client/getting-started) loads only when creating or
joining a room. PeerServer Cloud supplies signaling by default; the race simulation
runs in the host browser. A room with twelve racers needs eleven host data connections,
so upload bandwidth, latency and host performance affect play.

Room discovery uses a fixed address prefix so different protocol versions can
reach the join handshake and show a reload message. Bump `VERSION` for incompatible
game changes, but keep `ROOM_PREFIX` unchanged. Updated guests also check the legacy
version-12 address to report its mismatch. A guest still running version 12 must
reload first; its old lookup cannot discover newer hosts.

Deploy over HTTPS. No application backend is required for default signaling.
Networks that cannot establish direct WebRTC connections need a working TURN
relay. Configure these optional Vite environment variables before building:

| Variable               | Purpose                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `VITE_PEER_HOST`       | Custom PeerServer hostname, without a URL scheme                                              |
| `VITE_PEER_PORT`       | Custom signaling port, default `443`                                                          |
| `VITE_PEER_PATH`       | Custom signaling path, default `/`                                                            |
| `VITE_PEER_SECURE`     | Set to `false` only for local HTTP signaling                                                  |
| `VITE_ICE_SERVERS_URL` | Endpoint returning `{ "iceServers": [...] }` with STUN servers and temporary TURN credentials |

The ICE endpoint must allow the game's origin and return the browser's standard
`RTCIceServer` entries, including `urls` and, for TURN, temporary `username` and
`credential`. It replaces the default ICE list. All `VITE_*` values are public;
keep permanent relay secrets on the endpoint's server. Configure and verify your
relay before relying on multiplayer across restrictive networks.

Run the independent WebRTC browser suite with `pnpm test:multiplayer`. It starts
Vite on port 5184 and a local PeerServer on port 9001. It checks two fully rendered
racers and a full host with eleven lightweight browser clients using the production transport and
simulation, including room capacity, profile updates, countdown, driving and disconnects.
Phone checks cover visible Host/Join actions and room controls. The
regular browser suite still expects a running dev server; set `PLAYWRIGHT_BASE_URL`
to use a different port. For native GPU testing on macOS, use
`PLAYWRIGHT_GPU=metal pnpm test:multiplayer`. The regular suite also accepts
`PLAYWRIGHT_CHANNEL=chromium` and `PLAYWRIGHT_GPU=metal`.

Unit tests cover delayed and quantized snapshots, input replay, room authority,
timeouts and a complete twelve-racer race. These local tests do not verify public
PeerServer availability, TURN credentials, WAN performance, twelve physical devices,
or browsers beyond Chromium.

The [web-racing reference](https://github.com/MankyDanky/web-racing/blob/master/frontend/src/modules/multiplayer.js)
uses a host relay and 20 Hz position broadcasts. Vectide uses its own authoritative
input simulation and snapshot interpolation; no reference source was copied.

## Pickups

Race setup and the host lobby have a Pickups toggle, enabled by default. Each course
has five pickup rows. Palm uses five crates per row; Port and Storm use three, spaced between checkpoints with time to use each item. Rows stay clear of ramp approaches and landings. Distant crates fade in between 100 and 65 meters so later rows do not distract from checkpoints. Collect
one item at a time; a collected crate returns after seven seconds. Time trials and
lobby free ride have no items. Best laps with pickups use a separate local record.

Q, gamepad LB or the touch USE button activates the held item. Straight and seeking
torpedoes require near-direct hull contact to explode. Sea mines toss and grow from
the stern, splash down, then arm. Jet boost gives a short speed increase; wake boost is stronger
and leaves waves behind. Wake emitter builds a wave at the stern that spreads
outward and travels backwards. Explosions
raise expanding shockwaves that lift and push nearby craft. These waves deform
the ocean mesh and the same water field drives hull buoyancy, camera clearance and
spray. They are not separate overlay planes.

First place receives mostly wake emitters and some mines, never boosts or torpedoes.
The trailing third receives torpedoes and boosts only. Middle positions get a mix.
The host owns collection, random rewards, item use and hits in multiplayer; guests
send only input and receive bounded item snapshots alongside the race state.

## Courses

- **Palm Circuit**: rolling swells, palm islands, a coastal arch, and a direct return to the checkered finish.
- **Port Afterdark**: choppy water, narrow docks, cranes, and a container carrier.
- **Storm Signal**: heavy swell, offshore turbines, angular mountains, and a signal platform.

Each course has 16 gates. Storm's start line faces its first checkpoint across an open launch straight. Palm has a pair of linked optional ramps plus a smaller opening ramp, and turns directly toward the finish after the jump straight. Port has no ramps: its dock passages and sheltered basins lead into a direct final approach. Storm runs counterclockwise, with a west wave train, an open-water weave, and broad sweeps through the east-channel swell instead of ramps. Its western reef and shore leave open checkpoint approaches, the weave checkpoint sits before the turn, and the signal platform sits farther offshore. Each buoy follows its own local wave height; Storm uses taller masts to keep the gate opening readable above the swell. Palm's early bends have wider gates and shore clearance for weapon knockback; the eastern channel puts a sustained wave train across the racing line. Normal AI laps are about one minute; a three-lap race takes around three minutes. Race traffic and waves change lap times. Easy, Normal, and Expert change opponent pace; player handling stays consistent. Normal uses full throttle on open water and firmer braking in tight turns, while Expert carries more pace on calm courses and manages rough-water turns more conservatively. Flat-water cruising speed is approximately 82 km/h.

After finishing, AI keeps the craft riding while results appear with a brief headline scramble and panel sweep. Reduced motion uses a fade. The board lists every racer by position and adds their recorded time as they finish; disconnected racers appear last. Finishers cannot collide with racers still competing.

## Water and handling

`src/game/water.ts` owns three directional wave components and a four-meter world-space grid. Localized sheltered bays and directional swell zones modify the shared water field. The water vertex shader uses those same components and zones. The CPU interpolates the same mesh triangles rather than sampling a different smooth surface.

`src/game/physics.ts` advances at 120 fixed steps per second. Four hull contact points apply buoyancy and damping relative to the moving surface. Their force differences drive pitch and roll. Thrust, quadratic drag, lateral resistance, and steering depend on water contact. Speed adds planing lift. Launch acceleration stays quick, with roughly four seconds to build to 95 percent of cruising speed. Brief throttle releases preserve momentum; braking still slows the craft firmly, and prolonged coasting settles to a stop. Water-entry losses use impact speed relative to the moving wave face and hull alignment. Following a descending face adds bounded drive while in contact; airborne throttle adds no speed. Engine pitch and volume respond to loss of water contact. The rendered wave slopes also apply a gentle downhill horizontal force and yaw influence while the hull is in the water; cross-swells require small steering corrections. Closed wedge ramps extend their slope four meters below the surface and use rigid deck contact, hold the keel above their surface, and supply slope-based takeoff velocity. Ramp contact does not emit water spray. Swept side and rear wall collisions bounce riders away below deck height, while airborne riders can clear those faces. Airborne craft follow gravity without engine thrust.

This is an arcade model inspired by Wave Race's feel, not a reconstruction of Nintendo's source or a full fluid solver. The tuning keeps turns responsive while making rough water, landings, and loss of contact affect control.

Racers use equal-mass contact impulses and positional separation. Scenery collision volumes match the broad footprint of the visible objects. AI riders use the same hull simulation, brake into turns, and avoid nearby riders. Only Nova and Echo receive catch-up assistance when behind: up to 12 percent additional engine power. There is no position jump associated with catch-up. A stuck opponent can use the same immediate recovery mechanism.

## Rendering

The world, riders, and jet skis are procedural geometry. Static scenery is batched by material. The detailed water grid follows the rider in whole grid cells; a distant water plane fills the horizon. The water uses faceted shading, crest foam, and reflections without tile outlines. Instanced water cubes spray from the hull, fan out during turns, and burst on landings before settling into foam. Bloom, faceted lighting, wire edges, and a striped sun establish the visual style without downloaded textures or model services.

The rider has articulated knees and elbows, a padded racing vest, a full-face helmet, gloves, and boots. Hull acceleration and landing impacts drive leg compression; steering moves the hips and torso into the turn. Shift explicitly shifts the hips back and leans the torso rearward while keeping limb contacts attached. The torso counteracts hull pitch to keep the stance upright. Contact constraints keep the torso within limb reach before two-bone inverse kinematics places each joint. Stable bone frames prevent shin guards from twisting when a leg crosses vertical. Hands follow the steering grips. Deep wet carves extend the inside foot toward the water, while rider loading changes hull balance. Hard landings can bury the hull before buoyancy recovers it.

Load a trick by holding E or gamepad RB on the approach, then release near takeoff. Steering selects a spin. Releases up to 300 ms before takeoff are buffered; earlier releases cancel. Holding visibly crouches the rider. Flips and spins need enough airtime to finish. Landing a completed flip adds 10 percent to horizontal speed, capped at 2 m/s, once per landing. An unfinished trick throws the rider off; the rider falls, swims back beside the craft, and climbs aboard. Checkpoints cannot advance while detached. Ordinary jumps remain forgiving.

The close chase camera follows horizontal movement directly, maintaining its distance at speed, and stays above the wave surface. Rendering and physics have separate timing. The game pauses when focus is lost or the page is hidden. The course menu shows a single floating craft with course markers hidden. Multiplayer lobbies show the joined racers lined up on the water. Palm fronds curve and taper; sparse island clusters and varied tower silhouettes break up repeated scenery. On Palm and Port, a three-dolphin pod breaches near the first third of the course when approached, then dives away, once per lap. Their bodies arch through each jump and flex as they swim away. Storm has a distant cargo boat cruising beyond the offshore ridge with navigation lights and a small wake. The menu and HUD are semantic HTML over the WebGL canvas.

## Verification

Unit and integration tests cover wave/mesh agreement, buoyancy stability in all sea states, airborne thrust, ramp takeoff and landing, directional gate admission, racer impulses, recovery, bounded catch-up, scenery clearance, and complete six-rider three-lap races on all courses without recovery.

Rider tests cover wave and landing reactions, mirrored turn lean, frame-rate consistency, extreme contact reach, stable shin orientation, and upright posture. The browser suite also measures the rendered hand and foot contact errors during rough-water riding.

The browser smoke suite uses the running local server:

```sh
pnpm test:browser
```

Browser captures are in `artifacts/`. Hardware gamepad feel and browsers beyond Chromium still need hands-on verification. Before the First Credit loops on the title screen when sound is enabled. Starting a race switches to its fixed course song; returning to the title screen restores its theme. Sapphire Wake loops on Palm Circuit, Neon Slipway on Port Afterdark, and Chrome Horizon on Storm Signal. Start Race enables audio when starting a race, and SOUND toggles music plus engine effects, with a speaker icon on mobile. A quiet low motor rumble and water rush follow speed, throttle, water contact and boost. Collecting an item plays a rising cue; torpedoes, mines, boosts and wake emitters have distinct activation sounds. These cues follow confirmed inventory changes for solo and multiplayer racers. A cyan energy plume extends from the stern nozzle under throttle, grows with speed and boost, and fades when coasting or braking. Pause freezes playback. A dedicated music analyser extracts bass, mid, and treble energy with adaptive peaks and smooth decay: nearby course lights, sun scale, bloom, wave-crest highlights and reflections respond without changing collision geometry or wave physics. Reduced-motion preferences disable the additional visual modulation. Music files load on demand.

Visual references: [Afterglow](https://afterglow.thebuilder.dk/), [Vector Wars](https://github.com/thebuilder/vector-wars), [thebuilder.dk](https://github.com/thebuilder/thebuilder-dk). Gameplay reference: [MoeGamer's Wave Race 64 review](https://moegamer.net/2018/02/09/n64-essentials-wave-race-64/).

## Web Analytics

Vercel Web Analytics initializes once from the app entry point. Enable Web Analytics for the Vercel project, then deploy this change to collect page views. Local Vite development uses the SDK's development mode.
