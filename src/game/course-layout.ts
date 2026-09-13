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
    checkpoints: [
      { name: 'Start / finish', at: [0, 0], width: 40 },
      { name: 'Crescent turn', at: [105, -140], width: 48 },
      { name: 'Reef entrance', at: [270, 30], width: 64 },
      { name: 'Outer reef', at: [262, 125], width: 64 },
      { name: 'Lagoon turn', at: [27.5, 167.5], width: 48 },
    ],
    route: [
      [0, 0],
      [0, -70],
      [35, -130],
      [105, -140],
      // Finish the sweeping turn before entering the reef wave train.
      [153, -98],
      [185, -60],
      [220, -24],
      [250, 5],
      [273, 40],
      [282, 77],
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
      {
        name: 'Crescent island',
        kind: 'island',
        x: 60,
        z: -40,
        height: 3.6,
        outline: [
          [13, -37],
          [18, -78],
          [58, -100],
          [94, -106],
          [119, -78],
          [112, -46],
          [92, -17],
          [64, 8],
          [25, 9],
        ].map(([x, z]) => ({ x, z })),
      },
      island('Reef headland', 235, -70, 50, 65, 3.1),
      {
        name: 'Outer island',
        kind: 'island',
        x: 130,
        z: 82,
        height: 9,
        // One continuous bank closes the misleading view and shortcut toward the jump straight.
        outline: [
          { x: 37.5, z: 75.0 },
          { x: 42.75, z: 38.26 },
          { x: 56.5, z: 15.56 },
          { x: 73.5, z: 15.56 },
          { x: 191.91, z: 37.81 },
          { x: 214.41, z: 58.7 },
          { x: 223.0, z: 92.5 },
          { x: 214.41, z: 126.3 },
          { x: 191.91, z: 147.19 },
          { x: 164.09, z: 147.19 },
          { x: 56.5, z: 134.44 },
          { x: 42.75, z: 111.74 },
        ],
      },
      island('West shore', -87.5, 77.5, 37.5, 80.0, 2.7),
      island('Lookout point', 290, -25, 50, 58, 3.4),
      island('Outer reef', 350, 75, 50, 125, 3.2),
      island('South sandbar', 112.5, 217.5, 135.0, 32.5, 1.8),
    ],
    zones: [
      zone('Start bay rollers', 0.0, -32.5, 0, 1, 125.0, 85.0, 0.35, 1.1, 26, 4),
      zone('Island lee', 97.5, -47.5, 0, 1, 100.0, 75.0, 0.8, 0),
      zone('Reef wave channel', 283, 80, -0.1, -Math.sqrt(0.99), 110, 110, 0.2, 2.7, 30, 5),
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
    checkpoints: [
      { name: 'Start / finish', at: [0, 0], width: 24 },
      { name: 'Container turn', at: [148.5, -90], width: 44 },
      { name: 'Inner basin', at: [139, 14], width: 32 },
      { name: 'Harbor mouth', at: [256.5, 78.75], width: 52 },
      { name: 'Cargo south passage', at: [175, 170], width: 44 },
      { name: 'Southwest basin', at: [50, 143], width: 44 },
      { name: 'West breakwater', at: [-69.75, 63], width: 44 },
    ],
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
      [-44, 40],
      [-20, 22],
      [0, 14],
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
      zone('South basin', 166.5, 167.4, 1, 0, 157.5, 72, 0.9, 0),
      zone('West basin', -31.5, 90, 0, 1, 126, 90, 0.85, 0),
    ],
    rampCenters: [],
  },
  storm: {
    checkpoints: [
      { name: 'Start / finish', at: [-36, 0], width: 40 },
      { name: 'West wave turn', at: [-118, 60], width: 56 },
      { name: 'Cross-swell reef', at: [32, 106], width: 40 },
      { name: 'East channel', at: [210, 63], width: 56 },
      { name: 'Signal north turn', at: [68, -142], width: 56 },
    ],
    route: [
      [-36, 0],
      [-72, 22],
      [-104, 45],
      [-119, 65],
      [-103, 111],
      [-60, 137],
      [-12, 126],
      [32, 106],
      [80, 131],
      [141, 149],
      [192, 123],
      [210, 63],
      [198, -9],
      [175, -79],
      [123, -127],
      [58, -144],
      [11, -109],
      [0, -60],
    ],
    land: [
      island('Signal island', 85, -42, 134, 126, 14, 'rock'),
      island('East breakwater', 142, 52, 34, 128, 9, 'rock'),
      island('Cross-swell reef', 36, 147, 42, 44, 6, 'rock'),
      island('Western reef', -45, 78, 32, 44, 6, 'rock'),
      island('South shelter', 92, 206, 106, 32, 9, 'rock'),
      island('Offshore ridge', 260, 40, 56, 148, 18, 'rock'),
      island('Western shore', -184, 50, 42, 120, 12, 'rock'),
    ],
    zones: [
      zone('Signal lee', -8, 6, 0, 1, 104, 72, 0.88, 0),
      zone('North swell', 104, -128, -1, 0, 144, 88, 0.3, 1.3, 37, 6),
      zone('Exposed east channel', 196, 42, 0, -1, 176, 72, 0.05, 1.8, 34, 6),
      zone('Cross-swell bend', 32, 91, -1, 0.35, 112, 80, 0.25, 1.1, 32, 5),
      zone('West wave train', -114, 56, 0, 1, 104, 70, 0.1, 1.4, 29, 5),
      zone('Departure lee', -48, 18, 1, 0, 96, 52, 0.9, 0),
    ],
    rampCenters: [],
  },
} satisfies Record<
  string,
  {
    route: number[][];
    checkpoints: { name: string; at: number[]; width: number }[];
    land: Landform[];
    zones: WaveZone[];
    rampCenters: number[][];
  }
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
