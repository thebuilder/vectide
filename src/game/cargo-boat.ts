import * as T from 'three';
import { box, glowing, outlined } from './geometry';
import { loft } from './modeling';
import type { Track } from './tracks';
import { waterHeight } from './water';

/** Distant shipping stays outside the course and follows a continuous offshore loop. */
export function createCargoBoat(track: Track) {
  const group = new T.Group();
  group.name = 'offshore-cargo-boat';
  const ship = new T.Group();
  group.add(ship);
  const hull = outlined(
    loft(
      [
        { at: -42, width: 9, depth: 5 },
        { at: -25, width: 13, depth: 6 },
        { at: 24, width: 13, depth: 6 },
        { at: 44, width: 1, depth: 4 },
      ],
      8,
      'z',
    ),
    '#617889',
    new T.MeshStandardMaterial({ color: '#283845', roughness: 0.8, flatShading: true }),
  );
  ship.add(hull);
  box(ship, 22, 2, 64, 0, 5, 0, '#617889');
  for (const [row, z] of [-12, 5, 22].entries())
    for (const x of [-6, 6])
      box(
        ship,
        10,
        7 + (row % 2) * 3,
        14,
        x,
        9,
        z,
        row % 2 ? '#806543' : '#536c78',
        new T.MeshStandardMaterial({ color: row % 2 ? '#806543' : '#536c78', roughness: 0.9 }),
      );
  box(
    ship,
    19,
    15,
    15,
    0,
    12,
    -28,
    '#92a6ad',
    new T.MeshStandardMaterial({ color: '#697b83', roughness: 0.8 }),
  );
  box(ship, 20, 2, 16, 0, 20, -28, '#b1c0c5');
  box(ship, 16, 2, 0.3, 0, 17, -20.3, '#ffe1a1', glowing('#ffe1a1', 0.6));
  box(ship, 1, 13, 1, 0, 27, -28, '#92a6ad');
  box(ship, 2, 1.5, 2, 0, 34, -28, '#ffe1a1', glowing('#ffe1a1', 1.2));
  for (const side of [-1, 1]) {
    const color = side === -1 ? '#ff5b66' : '#86fadd';
    box(ship, 1.5, 1.5, 1.5, side * 10, 19, -24, color, glowing(color, 1));
  }
  const wakeGeometry = new T.BufferGeometry();
  wakeGeometry.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [-9, -1.5, -38, -28, -1.5, -120, -17, -1.5, -95, 9, -1.5, -38, 17, -1.5, -95, 28, -1.5, -120],
      3,
    ),
  );
  group.add(
    new T.Mesh(
      wakeGeometry,
      new T.MeshBasicMaterial({
        color: '#aacbd0',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    ),
  );
  return {
    group,
    update(time: number) {
      const angle = Math.PI + time * 0.012;
      const x = 650 + Math.cos(angle) * 300,
        z = 300 + Math.sin(angle) * 250;
      group.position.set(x, waterHeight(x, z, time, track) * 0.4 + 1.5, z);
      group.rotation.y = Math.atan2(-300 * Math.sin(angle), 250 * Math.cos(angle));
      ship.rotation.x = Math.sin(time * 0.45) * 0.012;
      ship.rotation.z = Math.sin(time * 0.32) * 0.018;
    },
  };
}
