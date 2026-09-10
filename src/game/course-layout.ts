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
      [0, -70],
      [35, -130],
      [105, -140],
      [155, -100],
      [142, -55],
      [135, -25],
      [150, 4],
      [170, 15],
      [217.5, -2.5],
      [270, 25],
      [278, 72],
      [278, 110],
      [227.5, 150],
      [165, 170],
      [95, 170],
      [27.5, 167.5],
      [0, 135],
      [0, 80],
      [0, 30],
    ],
    land: [
      island('Crescent island', 45, -37, 65, 95, 7),
      island('Reef headland', 225, -68, 45, 60, 8),
      island('Outer island', 178, 80, 90, 90, 9),
      island('Lagoon island', 65, 75, 55, 125, 16),
      island('West shore', -87.5, 77.5, 37.5, 80.0, 6),
      island('Lookout point', 282, -32.5, 50, 62.5, 13),
      island('Outer reef', 350, 75, 50, 125, 8),
      island('South sandbar', 112.5, 217.5, 135.0, 32.5, 3),
    ],
    zones: [
      zone('Start bay rollers', 0.0, -32.5, 0, 1, 125.0, 85.0, 0.35, 1.1, 26, 4),
      zone('Island lee', 97.5, -47.5, 0, 1, 100.0, 75.0, 0.8, 0),
      zone('Reef wave channel', 274, 65, 0, -1, 130, 120, 0.2, 2.7, 30, 5),
      zone('Jump straight', 142.5, 168.5, 1, 0, 210.0, 77.5, 0.88, 0),
      zone('Inner lagoon', -32.5, 77.5, 0, 1, 130.0, 95.0, 0.9, 0),
    ],
    rampCenters: [
      [205, 170],
      [105, 170],
      [-3, -27.5, 0, -1],
    ],
  },
  harbor: {
    route: [
      [0, 0],
      [0, -72],
      [38.25, -110.25],
      [103.5, -110.25],
      [148.5, -90],
      [157.5, -42.75],
      [128.25, -9],
      [157.5, 36],
      [220.5, 36],
      [256.5, 78.75],
      [256.5, 139.5],
      [189, 168.75],
      [112.5, 168.75],
      [72, 130.5],
      [27, 144],
      [-36, 126],
      [-69.75, 63],
      [-45, 18],
      [-20.25, 38.25],
      [0, 31.5],
    ],
    land: [
      dock('West entrance pier', -17.1, -38.25, 12.6, 65.25),
      dock('East entrance pier', 17.1, -38.25, 12.6, 65.25),
      dock('Container quay', 74.25, -83.25, 60.75, 31.5),
      dock('Inner basin pier', 98.1, 45, 42.75, 81),
      dock('Cargo terminal', 193.5, 98.1, 69.75, 76.5),
      dock('South quay', 157.5, 209.25, 121.5, 33.75),
      dock('West breakwater', -96.75, 72, 15.75, 85.5),
      dock('Outer breakwater', 297, 105.75, 20.25, 135),
    ],
    zones: [
      zone('Entrance channel', 0, -31.5, 0, 1, 162, 76.5, 0.92, 0),
      zone('Working basin', 101.25, -58.5, 0, 1, 162, 139.5, 0.8, 0),
      zone('Harbor mouth', 254.25, 110.25, 0, -1, 119.25, 74.25, 0.1, 1.8, 27, 4),
      zone('Jump lane', 166.5, 167.4, 1, 0, 157.5, 72, 0.9, 0),
      zone('West basin', -31.5, 90, 0, 1, 126, 90, 0.85, 0),
    ],
    rampCenters: [
      [215, 163.8],
      [160, 163.8],
    ],
  },
  storm: {
    route: [
      [0, 0],
      [-8, -62],
      [24, -114],
      [90, -140],
      [158, -116],
      [196, -52],
      [210, 20],
      [214, 80],
      [172, 148],
      [120, 164],
      [68, 164],
      [18, 164],
      [-15, 143],
      [-60, 128],
      [-110, 88],
      [-125, 42],
      [-104, -8],
      [-62, 12],
      [-28, 42],
      [0, 32],
    ],
    land: [
      island('Signal island', 64, -42, 92, 120, 14, 'rock'),
      island('East breakwater', 142, 52, 34, 92, 9, 'rock'),
      island('Western reef', -60, 58, 40, 56, 10, 'rock'),
      island('South shelter', 92, 206, 106, 32, 9, 'rock'),
      island('Offshore ridge', 260, 40, 56, 148, 18, 'rock'),
      island('Western shore', -164, 50, 42, 120, 16, 'rock'),
    ],
    zones: [
      zone('Signal lee', -8, 6, 0, 1, 104, 72, 0.88, 0),
      zone('North swell', 104, -128, -1, 0, 144, 88, 0.3, 1.3, 37, 6),
      zone('Exposed east channel', 196, 42, 0, -1, 176, 72, 0.05, 1.8, 34, 6),
      zone('Jump shelter', 114, 164, 1, 0, 156, 72, 0.85, 0),
      zone('West wave train', -114, 56, 0, 1, 104, 70, 0.1, 1.4, 29, 5),
      zone('Home lee', -48, 18, 1, 0, 96, 52, 0.9, 0),
    ],
    rampCenters: [
      [132, 160],
      [68, 160],
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
