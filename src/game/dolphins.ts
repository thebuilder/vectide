import * as T from 'three';
import { poseDolphin } from './dolphin-pose';
import { createDolphinModel } from './dolphin-model';
import { waterHeight } from './water';
import type { Track } from './tracks';
import type { Racer } from './physics';
export function createDolphins(track: Track) {
  const group = new T.Group();
  group.name = 'dolphin-pod';
  const model = createDolphinModel();
  const animals = Array.from({ length: 3 }, () => {
    const animal = model.clone();
    group.add(animal);
    return animal;
  });
  let started = -Infinity,
    lastLap = -1,
    previousTime = 0;
  const location = track.dolphin;
  return {
    group,
    update(t: number, player: Racer) {
      if (t < previousTime) {
        lastLap = -1;
        started = -Infinity;
      }
      previousTime = t;
      if (player.lap !== lastLap && Math.hypot(player.x - location.x, player.z - location.z) < 45) {
        started = t;
        lastLap = player.lap;
      }
      animals.forEach((animal, i) => {
        const age = t - started - i * 0.45;
        animal.visible = age >= 0 && age < 8;
        if (!animal.visible) return;
        poseDolphin(animal, age);
        // Swim alongside the outside of the bend, without drifting into the racing line.
        const forward = 20 + age * 14,
          side = -(14 + i * 3);
        const x = location.x + location.tx * forward - location.tz * side;
        const z = location.z + location.tz * forward + location.tx * side;
        const phase = Math.min(age / 2.5, 1),
          jump = age < 2.5 ? Math.sin(phase * Math.PI) * 4 : -Math.min((age - 2.5) * 1.5, 6);
        animal.position.set(x, waterHeight(x, z, t, track) + jump - 0.5, z);
        animal.rotation.set(
          -Math.atan2(age < 2.5 ? Math.cos(phase * Math.PI) * 5 : -1.5, 14),
          Math.atan2(location.tx, location.tz),
          0,
        );
      });
    },
  };
}
