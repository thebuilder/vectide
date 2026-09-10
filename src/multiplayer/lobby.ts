import { createRacer } from '../game/physics';
import type { Track } from '../game/tracks';
import { waterHeight } from '../game/water';
import { COLORS, type Member } from './protocol';

/** A compact raft of five craft per row keeps the whole room visible on a phone. */
export function createLobbyRacers(track: Track, members: Member[]) {
  const gate = track.gates[0];
  return members.map((member, index) => {
    const row = Math.floor(index / 5);
    const columns = Math.min(5, members.length - row * 5);
    const side = ((index % 5) - (columns - 1) / 2) * 5.5;
    const x = gate.x - gate.tx * (22 + row * 7) - gate.tz * side;
    const z = gate.z - gate.tz * (22 + row * 7) + gate.tx * side;
    return Object.assign(createRacer(track, member.slot), {
      x,
      z,
      y: waterHeight(x, z, 0, track) + 0.6,
      name: member.name,
      color: COLORS[member.color],
    });
  });
}
export function lobbyCamera(track: Track, count: number, aspect: number) {
  const gate = track.gates[0];
  const rows = Math.ceil(count / 5),
    columns = Math.min(5, count);
  const x = gate.x - gate.tx * (22 + (rows - 1) * 3.5);
  const z = gate.z - gate.tz * (22 + (rows - 1) * 3.5);
  const distance = Math.max(
    18,
    ((columns - 1) * 2.75 + 4) / (Math.tan((Math.PI * 31) / 180) * aspect),
  );
  return {
    target: { x, y: 1.2, z },
    position: {
      x: x + gate.tx * distance - gate.tz * distance * 0.08,
      y: distance * 0.48 + 3,
      z: z + gate.tz * distance + gate.tx * distance * 0.08,
    },
  };
}
