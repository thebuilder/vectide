import { CatmullRomCurve3, Vector3 } from 'three';

export interface Point {
  x: number;
  z: number;
}
export interface Gate extends Point {
  tx: number;
  tz: number;
  width: number;
}
export interface Ramp extends Gate {
  baseHeight: number;
  length: number;
  height: number;
}
export interface Obstacle extends Point {
  radius: number;
}
export interface Track {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  sea: string;
  accent: string;
  sky: string;
  horizon: string;
  water: string;
  wave: number;
  points: Point[];
  gates: Gate[];
  landmark: Gate;
  dolphin: Gate;
  ramps: Ramp[];
  obstacles: Obstacle[];
  length: number;
}
const definitions = [
  {
    id: 'palms',
    name: 'PALM CIRCUIT',
    subtitle: 'The golden hour',
    description: 'Wide water. Palm islands. A sweeping approach to the sunset finish.',
    sea: 'ROLLING',
    accent: '#86fadd',
    sky: '#080a20',
    horizon: '#ad385e',
    water: '#073438',
    wave: 1.35,
    route: [
      [0, 0],
      [130, -280],
      [460, -370],
      [680, -160],
      [670, 190],
      [420, 350],
      [140, 360],
      [-100, 370],
      [-230, 240],
      [-110, 140],
    ],
  },
  {
    id: 'harbor',
    name: 'PORT AFTERDARK',
    subtitle: 'Between the iron giants',
    description: 'Thread the docks beneath cranes and violet city lights.',
    sea: 'CHOPPY',
    accent: '#b890ff',
    sky: '#07081d',
    horizon: '#402465',
    water: '#151f3e',
    wave: 1.65,
    route: [
      [0, 0],
      [0, -300],
      [250, -430],
      [500, -290],
      [470, -40],
      [700, 100],
      [550, 360],
      [280, 290],
      [100, 430],
      [-170, 240],
      [-200, 30],
    ],
  },
  {
    id: 'storm',
    name: 'STORM SIGNAL',
    subtitle: 'Out past the breakwater',
    description: 'Heavy swell. Offshore turbines. Ride the face of the storm.',
    sea: 'ROUGH',
    accent: '#ffbc57',
    sky: '#080f20',
    horizon: '#344c67',
    water: '#0a2839',
    wave: 2.3,
    route: [
      [0, 0],
      [100, -320],
      [430, -420],
      [700, -170],
      [560, 130],
      [700, 400],
      [320, 480],
      [100, 240],
      [-200, 350],
      [-380, 60],
      [-260, -200],
    ],
  },
];
export const TRACKS: Track[] = definitions.map((d) => {
  const curve = new CatmullRomCurve3(
    d.route.map(
      ([x, z]) =>
        new Vector3(
          x * (d.id === 'storm' ? 0.24 : d.id === 'harbor' ? 0.32 : 0.33),
          0,
          z * (d.id === 'storm' ? 0.24 : d.id === 'harbor' ? 0.32 : 0.33),
        ),
    ),
    true,
    'catmullrom',
    0.3,
  );
  const points = curve
    .getSpacedPoints(640)
    .slice(0, -1)
    .map((p) => ({ x: p.x, z: p.z }));
  const at = (fraction: number): Gate => {
    const p = curve.getPointAt(fraction),
      t = curve.getTangentAt(fraction);
    return { x: p.x, z: p.z, tx: t.x, tz: t.z, width: d.id === 'harbor' ? 25 : 32 };
  };
  const gates = Array.from({ length: 12 }, (_, i) => at(i / 12));
  // Aim the start grid down the opening leg now that checkpoints are farther apart.
  const openingX = gates[1].x - gates[0].x,
    openingZ = gates[1].z - gates[0].z;
  const openingLength = Math.hypot(openingX, openingZ);
  gates[0].tx = openingX / openingLength;
  gates[0].tz = openingZ / openingLength;
  const ramps = [7 / 32, 22 / 32].map((fraction) => {
    const anchor = at(fraction);
    const x = anchor.x - anchor.tz * 11,
      z = anchor.z + anchor.tx * 11;
    const target = gates[Math.ceil(fraction * gates.length) % gates.length];
    const distance = Math.hypot(target.x - x, target.z - z);
    return {
      ...anchor,
      x: x - ((target.x - x) / distance) * 11,
      z: z - ((target.z - z) / distance) * 11,
      tx: (target.x - x) / distance,
      tz: (target.z - z) / distance,
      width: 9,
      length: 42,
      baseHeight: -4.08,
      height: 7.98,
    };
  });
  return {
    ...d,
    points,
    gates,
    ramps,
    landmark: at(d.id === 'harbor' ? 2 / 32 : 13 / 32),
    dolphin: at(10 / 32),
    obstacles: [],
    length: curve.getLength(),
  };
});
export function routePoint(track: Track, index: number): Point {
  return track.points[
    ((Math.floor(index) % track.points.length) + track.points.length) % track.points.length
  ];
}
export function nearestPoint(track: Track, p: Point): number {
  let nearest = 0,
    distance = Infinity;
  track.points.forEach((v, i) => {
    const d = (v.x - p.x) ** 2 + (v.z - p.z) ** 2;
    if (d < distance) {
      distance = d;
      nearest = i;
    }
  });
  return nearest;
}
