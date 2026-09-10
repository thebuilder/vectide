import { COURSE_LAYOUTS, fitGateToShore, landmarkObstacles, type Landform } from './course-layout';
import { waveZoneWeight, type WaveZone } from './water';
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
  targetGate?: number;
}
export interface Obstacle extends Point {
  radius: number;
}
export interface Track {
  id: string;
  practiceRadius?: number;
  name: string;
  subtitle: string;
  description: string;
  sea: string;
  accent: string;
  sky: string;
  horizon: string;
  water: string;
  wave: number;
  waveZones?: WaveZone[];
  points: Point[];
  gates: Gate[];
  landmark: Gate;
  dolphin: Gate;
  ramps: Ramp[];
  obstacles: Obstacle[];
  land: Landform[];
  length: number;
}
const definitions = [
  {
    id: 'palms',
    name: 'PALM CIRCUIT',
    subtitle: 'The golden hour',
    description:
      'Carve around palm islands, ride the reef swell, and link two jumps above a sheltered lagoon.',
    sea: 'ROLLING',
    accent: '#86fadd',
    sky: '#080a20',
    horizon: '#ad385e',
    water: '#073438',
    wave: 1.35,
  },
  {
    id: 'harbor',
    name: 'PORT AFTERDARK',
    subtitle: 'Between the iron giants',
    description:
      'Thread the docks, cross the harbor swell, and line up the double jump beneath violet city lights.',
    sea: 'CHOPPY',
    accent: '#b890ff',
    sky: '#07081d',
    horizon: '#402465',
    water: '#151f3e',
    wave: 1.65,
  },
  {
    id: 'storm',
    name: 'STORM SIGNAL',
    subtitle: 'Out past the breakwater',
    description:
      'Heavy swell between rocky islands. Find the sheltered line, or launch off the exposed wave trains.',
    sea: 'ROUGH',
    accent: '#ffbc57',
    sky: '#080f20',
    horizon: '#344c67',
    water: '#0a2839',
    wave: 2.3,
  },
];
export const TRACKS: Track[] = definitions.map((d) => {
  const layout = COURSE_LAYOUTS[d.id as keyof typeof COURSE_LAYOUTS];
  const curve = new CatmullRomCurve3(
    layout.route.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'catmullrom',
    0.3,
  );
  const points = curve
    .getSpacedPoints(960)
    .slice(0, -1)
    .map((p) => ({ x: p.x, z: p.z }));
  const at = (fraction: number): Gate => {
    const p = curve.getPointAt(fraction),
      t = curve.getTangentAt(fraction);
    // The jump straight leaves room to pass each optional ramp on either side.
    const exposed = layout.zones.some(
      (zone) => zone.swell > 0 && waveZoneWeight(p.x, p.z, zone) > 0.15,
    );
    const width = exposed
      ? 56
      : fraction > 0.55 && fraction < 0.8
        ? 46
        : d.id === 'harbor'
          ? 24
          : 32;
    return { x: p.x, z: p.z, tx: t.x, tz: t.z, width };
  };
  // Keep checkpoint spacing readable on the compact one-minute courses.
  const gateCount = d.id === 'palms' ? 24 : 16;
  const gates = Array.from({ length: gateCount }, (_, i) =>
    fitGateToShore(at(i / gateCount), layout.land),
  );
  const ramps: Ramp[] = layout.rampCenters.map(([x, z, tx = -1, tz = 0]) => {
    const early = d.id === 'palms' && tz === -1,
      compact = d.id !== 'palms';
    const ramp = {
      x,
      z,
      tx,
      tz,
      width: early ? 9 : 12,
      length: early ? 26 : compact ? 20 : 40,
      baseHeight: -4.2,
      height: early || compact ? 7 : 9.5,
    };
    const target = gates
      .map((gate, index) => ({
        index,
        along: (gate.x - x) * ramp.tx + (gate.z - z) * ramp.tz,
        side: Math.abs(-(gate.x - x) * ramp.tz + (gate.z - z) * ramp.tx),
        gate,
      }))
      .filter(
        (v) =>
          v.along > ramp.length / 2 &&
          v.along < 210 &&
          v.side < v.gate.width / 2 - 2 &&
          v.gate.tx * ramp.tx + v.gate.tz * ramp.tz > 0.5,
      )
      .sort((a, b) => a.along - b.along)[0];
    return { ...ramp, targetGate: target?.index };
  });
  const landmark = at(d.id === 'palms' ? 0.42 : d.id === 'harbor' ? 0.46 : 0.36);
  return {
    ...d,
    wave: d.id === 'palms' ? 0.8 : d.id === 'harbor' ? 0.95 : 1.25,
    waveZones: layout.zones,
    points,
    gates,
    ramps,
    land: layout.land,
    landmark,
    dolphin: at(0.22),
    obstacles: landmarkObstacles(d.id, landmark),
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
