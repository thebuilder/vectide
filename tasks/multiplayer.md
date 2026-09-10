# PeerJS multiplayer

Private rooms support 2–10 human racers. The host selects one of the existing courses,
waits for everyone to load, and starts a shared three-lap race. Joining uses a room
code. Single-player races and time trials retain their existing behavior.

The host runs the existing 120 Hz physics, collisions, checkpoint rules and finish
timing. Guests send sequenced input batches at 20 Hz, predict their own craft, and
replay unacknowledged inputs after authoritative snapshots. Remote craft render
from a short snapshot buffer. Queues, packet sizes and extrapolation are bounded.

Use PeerJS with one connection per guest to the host. Validate incoming messages
and bind input ownership to the connection. No client-submitted positions or race
results are accepted by the host. A loading barrier precedes the countdown.

Leaving mid-race marks a guest disconnected. Host departure or timeout ends the
room with a visible explanation. Online menus release driving input but do not
pause the shared race. No host migration, public matchmaking, accounts or dedicated
authoritative server are included. A host is trusted and can modify its own game.

PeerServer Cloud is the default signaling service. Deployment can configure its own
PeerServer and an endpoint issuing temporary TURN credentials. Never embed permanent
TURN secrets in browser configuration.

Build order: simulation and protocol with deterministic tests; room transport and
lifecycle tests; engine/UI integration; real WebRTC browser verification.

Acceptance: ten distinct slots and an eleventh rejection, shared countdown/course,
responsive guest controls and convergence under delay, host-owned results,
malformed/stale input rejection, bounded recovery after disconnects, and unchanged
solo behavior. Verify Chromium browser flow and document limits of local network
testing.

Reference inspected: MankyDanky/web-racing uses host-relayed positions at 20 Hz and
direct transform assignment. The new implementation uses its own input simulation
and reconciliation; no reference source is copied.

The title screen now places separate Host and Join actions beside Hit the Water,
visible without scrolling at 320 × 568 and 375 × 667. The water lobby displays the
connected craft in rows, with a prominent copyable room code, editable names and
colors, host course selection, Start Race and Leave Room. Profile changes travel
through the host and freeze when loading starts. Removed the replay-intro action
and the capacity callout from the title screen.

Verification includes unit tests, existing browser checks, and
multiplayer browser scenarios covering two rendered games, ten connections, and
the phone menu/lobby. Production build and formatting checks pass. Local clients
also connected through the default public PeerServer during development. Different
physical devices, WAN latency, other browsers, and TURN relay operation remain
unverified.

Signaling reconnects preserve the roster and active WebRTC race. Mocked lobby and
race tests and a real PeerJS signaling disconnect cover this recovery path.

Lobby free ride uses a separate 220-meter-wide practice lagoon with two ramps and
an enforced floating boundary. Entering hides settings and enables normal riding
controls; returning parks the craft and restores settings. The host synchronizes
practice movement, and joins/profile/course changes retain active riders. Starting
the race replaces practice with a fresh grid and shared countdown. Practice never
records checkpoint or finish progress. Floating labels exclude the local rider.

Coverage includes boundary confinement, ramp launches, guest prediction, profile
locks, roster changes, stalled-host recovery, and transition to racing. Browser
checks cover two rendered clients and touch-driven entry/return on a phone layout.
