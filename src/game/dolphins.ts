import * as T from 'three';
import { poseDolphin } from './dolphin-pose';
import { createDolphinModel } from './dolphin-model';
import { waterHeight, type WaterProfile } from './water';
import { VoxelSpray } from './spray';
import { steerDolphin } from './dolphin-ai';
import { shoreDistance } from './shore';
import type { Track } from './tracks';
import type { Racer } from './physics';

const swimmers = [
  { side: 6, lead: 14, delay: 0.15, interval: 2.3, lift: 5.1 },
  { side: -8, lead: 19, delay: 0.8, interval: 2.7, lift: 4.7 },
  { side: 9, lead: 24, delay: 1.4, interval: 2.5, lift: 5.4 },
];

export function createDolphins(track: Track) {
  const group = new T.Group();
  group.name = 'dolphin-pod';
  const spray = new VoxelSpray(384, 'swimmer');
  spray.object.name = 'dolphin-water';
  const model = createDolphinModel();
  const animals = swimmers.map((swimmer, i) => {
    const mesh = model.clone();
    mesh.scale.setScalar(1.3 + i * 0.07);
    group.add(mesh);
    return {
      ...swimmer,
      mesh,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      turnRate: 0,
      mode: 'approach' as 'approach' | 'escort',
      depth: 3,
      stroke: i * 2.1,
      jumpAt: -Infinity,
      jumpY: 0,
      nextJump: 0,
      targetId: null as number | null,
      interestUntil: 0,
      departAt: Infinity,
      wasAirborne: false,
      foam: 0,
    };
  });
  let started = -Infinity,
    lastLap = -1,
    previousTime = 0;
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
    waterEffects: spray.object,
    update(
      t: number,
      player: Racer,
      racers: readonly Racer[] = [player],
      water: WaterProfile = track,
    ) {
      if (t < previousTime) {
        lastLap = -1;
        started = -Infinity;
        spray.clear();
      }
      const dt = Math.min(Math.max(t - previousTime, 0), 0.1);
      previousTime = t;
      const speed = Math.hypot(player.vx, player.vz);
      const fx = speed > 1 ? player.vx / speed : Math.sin(player.yaw);
      const fz = speed > 1 ? player.vz / speed : Math.cos(player.yaw);
      if (
        player.lap !== lastLap &&
        speed > 6 &&
        Math.hypot(player.x - location.x, player.z - location.z) < 85
      ) {
        started = t;
        lastLap = player.lap;
        animals.forEach((a, i) => {
          a.side = swimmers[i].side;
          // Begin underwater in open ocean; the visible encounter starts only after the approach.
          const offshore = 32 + i * 7;
          for (const side of [Math.sign(a.side), -Math.sign(a.side)]) {
            a.x = player.x + fx * (a.lead + 8) + fz * offshore * side;
            a.z = player.z + fz * (a.lead + 8) - fx * offshore * side;
            if (clear(a.x, a.z)) {
              a.side = Math.abs(a.side) * side;
              break;
            }
          }
          a.yaw = Math.atan2(player.x + player.vx * 2.5 - a.x, player.z + player.vz * 2.5 - a.z);
          a.vx = Math.sin(a.yaw) * 16;
          a.vz = Math.cos(a.yaw) * 16;
          a.turnRate = 0;
          a.mode = 'approach';
          a.depth = 3;
          a.jumpAt = -Infinity;
          a.nextJump = t + a.delay;
          a.targetId = null;
          a.interestUntil = Infinity;
          a.departAt = Infinity;
          a.wasAirborne = false;
          a.foam = 0;
        });
      }
      const age = t - started;
      for (const a of animals) {
        const departure = Math.max(0, t - a.departAt);
        a.mesh.visible = age >= 0 && age < 18 && departure < 2.5;
        if (!a.mesh.visible) continue;
        let flight = t - a.jumpAt;
        const duration = (2 * a.lift) / 9.81;
        const approaching = a.mode === 'approach';
        const target = steerDolphin(a, animals, racers, clear, t, flight >= duration ? dt : 0);
        if (approaching && a.mode === 'escort') a.nextJump = t + a.delay;
        const distance = target ? Math.hypot(target.x - a.x, target.z - a.z) : 100;
        const boatClearance = Math.min(...racers.map((r) => Math.hypot(r.x - a.x, r.z - a.z)));
        const previousDepth = a.depth;
        const swimDepth =
          boatClearance < 10 ? 1.8 : 0.38 + Math.max(0, Math.min(1.6, (distance - 30) * 0.06));
        a.depth += (swimDepth - a.depth) * (1 - Math.exp(-dt * (boatClearance < 10 ? 5 : 1.6)));
        a.stroke += dt * (4.5 + Math.hypot(a.vx, a.vz) * 0.14);
        const targetSpeed = target ? Math.hypot(target.vx, target.vz) : 0;
        const tx = target ? target.vx / targetSpeed : fx;
        const tz = target ? target.vz / targetSpeed : fz;
        if (flight >= duration) {
          if (
            t >= a.nextJump &&
            target &&
            a.mode === 'escort' &&
            a.depth < 0.55 &&
            Math.hypot(a.vx, a.vz) > 7 &&
            // Wait through tight turns; a breach holds its takeoff heading.
            (a.vx * tx + a.vz * tz) / Math.hypot(a.vx, a.vz) > 0.98 &&
            Math.abs((a.x - target.x) * tz - (a.z - target.z) * tx - a.side) < 4 &&
            [0, 0.25, 0.5, 0.75, 1].every(
              (fraction) =>
                clear(a.x + a.vx * duration * fraction, a.z + a.vz * duration * fraction) &&
                racers.every(
                  (r) =>
                    Math.hypot(
                      a.x + a.vx * duration * fraction - r.x - r.vx * duration * fraction,
                      a.z + a.vz * duration * fraction - r.z - r.vz * duration * fraction,
                    ) > 5,
                ),
            )
          ) {
            a.jumpAt = t;
            a.jumpY = waterHeight(a.x, a.z, t, water) - a.depth;
            a.nextJump = t + a.interval + Math.sin(t * 1.7 + a.lead) * 0.35;
            flight = 0;
          }
        }
        const nextX = a.x + a.vx * dt,
          nextZ = a.z + a.vz * dt;
        if (clear(nextX, nextZ)) {
          a.x = nextX;
          a.z = nextZ;
        }
        const sea = waterHeight(a.x, a.z, t, water);
        const airborne = flight < duration;
        let y = sea - a.depth - Math.min(departure * 2.5, 5);
        let vertical = (previousDepth - a.depth) / Math.max(dt, 0.001) - (departure > 0 ? 2.5 : 0);
        if (airborne) {
          y = a.jumpY + a.lift * flight - 4.905 * flight * flight;
          vertical = a.lift - 9.81 * flight;
          // A moving crest can catch a diving dolphin before its nominal flight ends.
          if (vertical < 0 && y < sea - a.depth) {
            a.jumpAt = -Infinity;
            y = sea - a.depth;
          }
        }
        a.mesh.visible &&= clear(a.x, a.z);
        const aboveWater = y > sea - 0.15;
        if (a.mesh.visible && aboveWater !== a.wasAirborne) {
          spray.burst(a.x, sea - 0.25, a.z, aboveWater ? 0.08 : 0.15);
        }
        a.wasAirborne = aboveWater;
        if (a.mesh.visible && !aboveWater && departure === 0) {
          a.foam += dt * Math.min(22, Math.hypot(a.vx, a.vz)) * Math.max(0, 1 - a.depth / 0.7);
          while (a.foam >= 1) {
            spray.foamTrail(a.x, a.z, a.vx, a.vz);
            a.foam--;
          }
        }
        a.mesh.position.set(a.x, y, a.z);
        a.mesh.rotation.set(
          -Math.atan2(vertical, Math.max(8, Math.hypot(a.vx, a.vz))),
          a.yaw,
          -a.turnRate * 0.12,
        );
        poseDolphin(a.mesh, Number.isFinite(flight) ? flight : duration + 1, duration, a.stroke);
      }
      spray.update(dt, [], track, t, water);
    },
  };
}
