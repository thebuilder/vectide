import * as T from 'three';
import { poseDolphin } from './dolphin-pose';
import { createDolphinModel } from './dolphin-model';
import { waterHeight } from './water';
import { shoreDistance } from './shore';
import type { Track } from './tracks';
import type { Racer } from './physics';

const swimmers = [
  { side: 5, lead: 16, delay: 0.15, interval: 2.3, lift: 5.1 },
  { side: -6, lead: 21, delay: 0.8, interval: 2.7, lift: 4.7 },
  { side: 7, lead: 27, delay: 1.4, interval: 2.5, lift: 5.4 },
];

export function createDolphins(track: Track) {
  const group = new T.Group();
  group.name = 'dolphin-pod';
  const model = createDolphinModel();
  const animals = swimmers.map((swimmer) => {
    const mesh = model.clone();
    group.add(mesh);
    return { ...swimmer, mesh, x: 0, z: 0, vx: 0, vz: 0, jumpAt: -Infinity, jumpY: 0, nextJump: 0 };
  });
  let started = -Infinity,
    lastLap = -1,
    previousTime = 0,
    departAt = Infinity;
  const location = track.dolphin;
  const clear = (x: number, z: number) =>
    shoreDistance(x, z, track.shore) > 5 &&
    track.obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + 3) &&
    track.ramps.every(
      (r) =>
        Math.abs((x - r.x) * r.tx + (z - r.z) * r.tz) > r.length / 2 + 4 ||
        Math.abs((x - r.x) * r.tz - (z - r.z) * r.tx) > r.width / 2 + 4,
    );
  return {
    group,
    update(t: number, player: Racer) {
      if (t < previousTime) {
        lastLap = -1;
        started = -Infinity;
      }
      const dt = Math.min(Math.max(t - previousTime, 0), 0.1);
      previousTime = t;
      const speed = Math.hypot(player.vx, player.vz);
      const fx = speed > 1 ? player.vx / speed : Math.sin(player.yaw);
      const fz = speed > 1 ? player.vz / speed : Math.cos(player.yaw);
      if (
        player.lap !== lastLap &&
        speed > 6 &&
        Math.hypot(player.x - location.x, player.z - location.z) < 45
      ) {
        started = t;
        lastLap = player.lap;
        departAt = Infinity;
        animals.forEach((a, i) => {
          a.side = swimmers[i].side;
          a.x = player.x + fx * a.lead + fz * a.side;
          a.z = player.z + fz * a.lead - fx * a.side;
          if (!clear(a.x, a.z)) {
            a.side *= -1;
            a.x = player.x + fx * a.lead + fz * a.side;
            a.z = player.z + fz * a.lead - fx * a.side;
          }
          a.vx = player.vx;
          a.vz = player.vz;
          a.jumpAt = -Infinity;
          a.nextJump = t + a.delay;
        });
      }
      const age = t - started;
      if (departAt === Infinity && (age > 6 || speed < 4 || player.recovery.phase !== 'riding'))
        departAt = t;
      for (const a of animals) {
        const departure = Math.max(0, t - departAt);
        a.mesh.visible = age >= 0 && age < 9 && departure < 2.5;
        if (!a.mesh.visible) continue;
        let flight = t - a.jumpAt;
        const duration = (2 * a.lift) / 9.81;
        if (flight >= duration) {
          const side = a.side + Math.sign(a.side) * departure * 7;
          const targetX = player.x + fx * (a.lead + departure * 8) + fz * side;
          const targetZ = player.z + fz * (a.lead + departure * 8) - fx * side;
          let vx = player.vx + (targetX - a.x) * 2,
            vz = player.vz + (targetZ - a.z) * 2;
          const limit = Math.min(32, Math.max(12, speed + 5)) / Math.max(1, Math.hypot(vx, vz));
          if (limit < 1) {
            vx *= limit;
            vz *= limit;
          }
          const follow = 1 - Math.exp(-dt * 5);
          a.vx += (vx - a.vx) * follow;
          a.vz += (vz - a.vz) * follow;
          if (
            t >= a.nextJump &&
            departAt === Infinity &&
            Math.hypot(a.vx, a.vz) > 7 &&
            // Wait through tight turns; a breach holds its takeoff heading.
            (a.vx * fx + a.vz * fz) / Math.hypot(a.vx, a.vz) > 0.98 &&
            Math.abs((a.x - player.x) * fz - (a.z - player.z) * fx - a.side) < 3 &&
            [0, 0.25, 0.5, 0.75, 1].every((fraction) =>
              clear(a.x + a.vx * duration * fraction, a.z + a.vz * duration * fraction),
            )
          ) {
            a.jumpAt = t;
            a.jumpY = waterHeight(a.x, a.z, t, track) - 0.45;
            a.nextJump = t + a.interval;
            flight = 0;
          }
        }
        const nextX = a.x + a.vx * dt,
          nextZ = a.z + a.vz * dt;
        if (clear(nextX, nextZ)) {
          a.x = nextX;
          a.z = nextZ;
        }
        const sea = waterHeight(a.x, a.z, t, track);
        const airborne = flight < duration;
        let y = sea - 0.45 - Math.min(departure * 2.5, 5);
        let vertical = 0;
        if (airborne) {
          y = a.jumpY + a.lift * flight - 4.905 * flight * flight;
          vertical = a.lift - 9.81 * flight;
          // A moving crest can catch a diving dolphin before its nominal flight ends.
          if (vertical < 0 && y < sea - 0.45) {
            a.jumpAt = -Infinity;
            y = sea - 0.45;
          }
        }
        a.mesh.visible &&= clear(a.x, a.z);
        a.mesh.position.set(a.x, y, a.z);
        a.mesh.rotation.set(
          -Math.atan2(vertical, Math.max(8, Math.hypot(a.vx, a.vz))),
          Math.atan2(a.vx, a.vz),
          0,
        );
        poseDolphin(a.mesh, Number.isFinite(flight) ? flight : duration + t, duration);
      }
    },
  };
}
