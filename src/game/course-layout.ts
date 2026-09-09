import { polygonContact } from './hull-contact';
import type { Point, Obstacle, Gate } from './tracks';
import type { WaveZone } from './water';
export interface Landform {
  name: string;
  kind: 'island' | 'dock' | 'rock';
  x: number;
  z: number;
  height: number;
  outline: Point[];
}
const island = (
  name: string,
  x: number,
  z: number,
  width: number,
  length: number,
  height = 5,
  kind: Landform['kind'] = 'island',
): Landform => ({
  name,
  kind,
  x,
  z,
  height,
  outline: Array.from({ length: 10 }, (_, i) => ({
    x: x + (Math.cos((i * Math.PI) / 5) * width) / 2,
    z: z + (Math.sin((i * Math.PI) / 5) * length) / 2,
  })),
});
const dock = (name: string, x: number, z: number, width: number, length: number): Landform => ({
  name,
  kind: 'dock',
  x,
  z,
  height: 3,
  outline: [
    { x: x - width / 2, z: z - length / 2 },
    { x: x + width / 2, z: z - length / 2 },
    { x: x + width / 2, z: z + length / 2 },
    { x: x - width / 2, z: z + length / 2 },
  ],
});
const zone = (
  name: string,
  x: number,
  z: number,
  tx: number,
  tz: number,
  length: number,
  width: number,
  shelter: number,
  swell: number,
  wavelength = 30,
  speed = 5,
): WaveZone => {
  const n = Math.hypot(tx, tz);
  return { name, x, z, tx: tx / n, tz: tz / n, length, width, shelter, swell, wavelength, speed };
};
export const COURSE_LAYOUTS = {
  palms: {
    route: [
      [0, 0],
      [0, -140],
      [70, -250],
      [190, -280],
      [290, -205],
      [265, -100],
      [205, -50],
      [245, 25],
      [340, 30],
      [435, -5],
      [515, 55],
      [545, 190],
      [455, 300],
      [330, 340],
      [190, 340],
      [55, 335],
      [-50, 270],
      [-110, 160],
      [-85, 70],
      [-30, 80],
      [0, 60],
    ],
    land: [
      island('Crescent island', 100, -100, 130, 215, 7),
      island('Reef headland', 342, -115, 95, 150, 8),
      island('Outer island', 368, 170, 205, 205, 9),
      island('Lagoon island', 95, 144, 135, 270, 16),
      island('West shore', -175, 155, 75, 160, 6),
      island('Lookout point', 505, -65, 100, 125, 13),
      island('Outer reef', 635, 150, 100, 250, 8),
      island('South sandbar', 225, 435, 270, 65, 3),
    ],
    zones: [
      zone('Start bay rollers', 0, -65, 0, 1, 250, 170, 0.35, 1.1, 26, 4),
      zone('Island lee', 195, -95, 0, 1, 200, 150, 0.8, 0),
      zone('Reef wave channel', 525, 115, -0.2, -1, 350, 195, 0.2, 2.7, 30, 5),
      zone('Jump straight', 285, 337, 1, 0, 420, 155, 0.88, 0),
      zone('Inner lagoon', -65, 155, 0, 1, 260, 190, 0.9, 0),
    ],
    rampCenters: [
      [355, 330],
      [235, 330],
      [-6, -55, 0, -1],
    ],
  },
  harbor: {
    route: [
      [0, 0],
      [0, -160],
      [85, -245],
      [230, -245],
      [330, -200],
      [350, -95],
      [285, -20],
      [350, 80],
      [490, 80],
      [570, 175],
      [570, 310],
      [420, 375],
      [250, 375],
      [160, 290],
      [60, 320],
      [-80, 280],
      [-155, 140],
      [-100, 40],
      [-45, 85],
      [0, 70],
    ],
    land: [
      dock('West entrance pier', -38, -85, 28, 145),
      dock('East entrance pier', 38, -85, 28, 145),
      dock('Container quay', 165, -185, 135, 70),
      dock('Inner basin pier', 218, 100, 95, 180),
      dock('Cargo terminal', 430, 218, 155, 170),
      dock('South quay', 350, 465, 270, 75),
      dock('West breakwater', -215, 160, 35, 190),
      dock('Outer breakwater', 660, 235, 45, 300),
    ],
    zones: [
      zone('Entrance channel', 0, -70, 0, 1, 360, 170, 0.92, 0),
      zone('Working basin', 225, -130, 0, 1, 360, 310, 0.8, 0),
      zone('Harbor mouth', 565, 245, 0, -1, 265, 165, 0.1, 1.8, 27, 4),
      zone('Jump lane', 370, 372, 1, 0, 350, 160, 0.9, 0),
      zone('West basin', -70, 200, 0, 1, 280, 200, 0.85, 0),
    ],
    rampCenters: [
      [425, 364],
      [315, 364],
    ],
  },
  storm: {
    route: [
      [0, 0],
      [-20, -155],
      [60, -285],
      [225, -350],
      [395, -290],
      [490, -130],
      [465, 50],
      [535, 200],
      [430, 370],
      [300, 410],
      [170, 410],
      [45, 410],
      [-10, 300],
      [-150, 320],
      [-275, 220],
      [-305, 65],
      [-225, -40],
      [-145, 20],
      [-90, 90],
      [0, 80],
    ],
    land: [
      island('Signal island', 160, -105, 230, 300, 14, 'rock'),
      island('East breakwater', 355, 130, 85, 230, 9, 'rock'),
      island('Western reef', -150, 145, 100, 140, 10, 'rock'),
      island('South shelter', 230, 515, 265, 80, 9, 'rock'),
      island('Offshore ridge', 650, 100, 140, 370, 18, 'rock'),
      island('Western shore', -410, 125, 105, 300, 16, 'rock'),
    ],
    zones: [
      zone('Signal lee', -20, 15, 0, 1, 260, 180, 0.88, 0),
      zone('North swell', 260, -320, -1, 0, 360, 220, 0.3, 1.3, 37, 6),
      zone('Exposed east channel', 490, 105, 0, -1, 440, 180, 0.05, 1.8, 34, 6),
      zone('Jump shelter', 285, 410, 1, 0, 390, 180, 0.85, 0),
      zone('West wave train', -285, 140, 0, 1, 260, 175, 0.1, 1.4, 29, 5),
      zone('Home lee', -120, 45, 1, 0, 240, 130, 0.9, 0),
    ],
    rampCenters: [
      [310, 400],
      [200, 400],
    ],
  },
} satisfies Record<
  string,
  { route: number[][]; land: Landform[]; zones: WaveZone[]; rampCenters: number[][] }
>;

/** Collision data exists before the renderer and matches the landmark's local placement. */
export function landmarkObstacles(id: string, gate: Gate): Obstacle[] {
  const at = (side: number, along: number, radius: number) => ({
    x: gate.x + gate.tz * side + gate.tx * along,
    z: gate.z - gate.tx * side + gate.tz * along,
    radius,
  });
  if (id === 'palms')
    return [
      ...[-37, 37].map((side) => at(side, 0, 6)),
      { x: 205, z: 52, radius: 1 },
      { x: 235, z: 52, radius: 1 },
    ];
  if (id === 'harbor') return Array.from({ length: 9 }, (_, i) => at(100, i * 10 - 40, 12));
  return [at(75, 0, 25)];
}

/** Include the submerged shore slope and space for a buoy plus a passing hull. */
export function gatePointClear(x: number, z: number, land: Landform[]): boolean {
  const footprint = [
    { x: x - 3, z: z - 3 },
    { x: x + 3, z: z - 3 },
    { x: x + 3, z: z + 3 },
    { x: x - 3, z: z + 3 },
  ];
  return land.every(
    (form) =>
      !polygonContact(
        footprint,
        form.outline.map((p) => ({
          x: form.x + (p.x - form.x) * (form.kind === 'dock' ? 1 : 1.08),
          z: form.z + (p.z - form.z) * (form.kind === 'dock' ? 1 : 1.08),
        })),
      ),
  );
}
export function fitGateToShore(gate: Gate, land: Landform[]): Gate {
  const reach = (side: number) => {
    let safe = 0;
    for (let offset = 0.5; offset <= gate.width / 2; offset += 0.5) {
      if (!gatePointClear(gate.x - gate.tz * offset * side, gate.z + gate.tx * offset * side, land))
        break;
      safe = offset;
    }
    return safe;
  };
  const left = reach(-1),
    right = reach(1),
    shift = (right - left) / 2;
  return { ...gate, x: gate.x - gate.tz * shift, z: gate.z + gate.tx * shift, width: left + right };
}
