import * as T from 'three';
import { box, dark, glowing, outlined } from './geometry';
import type { Track } from './tracks';

export function addLandmarks(parent: T.Group, track: Track): void {
  const gate = track.landmark,
    landmark = new T.Group();
  landmark.position.set(gate.x, 0, gate.z);
  landmark.rotation.y = Math.atan2(gate.tx, gate.tz);
  parent.add(landmark);
  const color = track.accent;
  if (track.id === 'palms') {
    // An illuminated coastal arch: a recognizable midpoint, with an open racing span.
    for (const side of [-1, 1]) {
      box(landmark, 7, 28, 9, side * 37, 12, 0, color);
      const cap = outlined(new T.ConeGeometry(6, 8, 4), color, glowing(0xff5b82, 0.3));
      cap.position.set(side * 37, 30, 0);
      landmark.add(cap);
    }
    box(landmark, 80, 2, 5, 0, 24, 0, color);
    box(landmark, 78, 0.2, 5.2, 0, 25.2, 0, color, glowing(color, 1));
    for (let i = -3; i <= 3; i++)
      box(landmark, 1.5, 6, 0.5, i * 5, 20, -2.7, 0xff5b82, glowing(0xff5b82, 0.8));
  } else if (track.id === 'harbor') {
    // A container carrier just outside the channel, with a lit gantry over the water.
    box(landmark, 18, 11, 95, 100, 4, 0, color);
    for (let z = -30; z <= 30; z += 15)
      for (let x = 94; x <= 106; x += 6) {
        box(landmark, 5.5, 5, 13, x, 12, z, z % 30 === 0 ? 0xffbc57 : 0xff5b82);
        box(landmark, 5.5, 5, 13, x, 17, z, color);
      }
    box(landmark, 14, 18, 13, 100, 18, -36, color);
    box(landmark, 15, 3, 14, 100, 27, -36, 0x86fadd, glowing(0x86fadd, 0.3));
    for (const side of [-1, 1]) box(landmark, 2, 43, 3, side * 35, 20, 0, 0xffbc57);
    box(landmark, 80, 3, 4, 0, 40, 0, 0xffbc57);
    box(landmark, 0.12, 19, 0.12, 0, 29, 0, 0xffbc57);
  } else {
    // Offshore signal platform, helipad and a glowing radar dish.
    box(landmark, 40, 3, 35, 75, 19, 0, color);
    for (const x of [60, 90])
      for (const z of [-12, 12]) box(landmark, 2.5, 25, 2.5, x, 8, z, color);
    box(landmark, 14, 12, 15, 82, 26, 0, color);
    box(landmark, 1, 24, 1, 82, 42, 0, color);
    const dish = outlined(
      new T.SphereGeometry(6, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
      color,
      dark,
    );
    dish.position.set(82, 55, 0);
    dish.rotation.z = 0.6;
    landmark.add(dish);
    const light = new T.Mesh(new T.OctahedronGeometry(1.5), glowing(0xff5b82, 3));
    light.position.set(82, 60, 0);
    landmark.add(light);
    box(landmark, 7, 0.15, 1, 62, 21, 0, color, glowing(color));
    box(landmark, 1, 0.15, 7, 59, 21, 0, color, glowing(color));
    box(landmark, 1, 0.15, 7, 65, 21, 0, color, glowing(color));
  }
}
