import * as T from 'three';
import { loft } from './modeling';
import { waterHeight } from './water';
import type { Track } from './tracks';
import type { Racer } from './physics';
export function createDolphins(track: Track) {
  const group = new T.Group();
  group.name = 'dolphin-pod';
  const material = new T.MeshStandardMaterial({
    color: 0x6cbfc6,
    metalness: 0.25,
    roughness: 0.38,
    flatShading: true,
  });
  const animals = Array.from({ length: 3 }, () => {
    const animal = new T.Group();
    animal.add(
      new T.Mesh(
        loft(
          [
            { at: -1.5, width: 0.06, depth: 0.07 },
            { at: -0.7, width: 0.25, depth: 0.3 },
            { at: 0.25, width: 0.33, depth: 0.34 },
            { at: 0.9, width: 0.21, depth: 0.22 },
            { at: 1.35, width: 0.085, depth: 0.065 },
          ],
          10,
          'z',
        ),
        material,
      ),
    );
    for (const side of [-1, 1]) {
      const fin = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 3), material);
      fin.rotation.z = side * 1.2;
      fin.position.set(side * 0.42, -0.12, 0.05);
      animal.add(fin);
      const tail = new T.Mesh(new T.ConeGeometry(0.3, 0.7, 3), material);
      tail.rotation.z = (side * Math.PI) / 2;
      tail.position.set(side * 0.25, 0, -1.35);
      animal.add(tail);
    }
    const dorsal = new T.Mesh(new T.ConeGeometry(0.22, 0.65, 3), material);
    dorsal.position.set(0, 0.45, -0.15);
    animal.add(dorsal);
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
