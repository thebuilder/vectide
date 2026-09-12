import { COURSE_LAYOUTS, fitGateToShore, landmarkObstacles, type Landform } from './course-layout';
import { waveZoneWeight, type WaveZone } from './water';
import { CatmullRomCurve3, Vector3 } from 'three';
import { createShoreField, type ShoreField } from './shore';

export interface Point {
  x: number;
  z: number;
}
export interface Gate extends Point {
  name?: string;
  routeIndex?: number;
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
  shore?: ShoreField;
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
    horizon: '#812b48',
    water: '#073438',
    wave: 1.35,
  },
  {
    id: 'harbor',
    name: 'PORT AFTERDARK',
    subtitle: 'Between the iron giants',
    description:
      'Thread the docks, cross the harbor swell, and carve through sheltered basins beneath violet city lights.',
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
      'Run counterclockwise through the west wave train, weave across open water, and sweep home through heavy swell.',
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
    const width =
      exposed || (d.id === 'storm' && fraction > 0.03 && fraction < 0.55)
        ? 56
        : fraction > 0.55 && fraction < 0.8
          ? 46
          : d.id === 'harbor'
            ? 24
            : d.id === 'palms'
              ? 40
              : 32;
    return { x: p.x, z: p.z, tx: t.x, tz: t.z, width };
  };
  // Checkpoints guard route choices; the centerline remains independent of gate count.
  const gates = layout.checkpoints.map(({ name, at: [x, z], width }, index) => {
    const routeIndex = points.reduce(
      (best, p, i) =>
        Math.hypot(p.x - x, p.z - z) < Math.hypot(points[best].x - x, points[best].z - z)
          ? i
          : best,
      0,
    );
    const center = at(routeIndex / points.length);
    const exit = points[(routeIndex + 28) % points.length];
    const heading = Math.atan2(center.tx, center.tz);
    const exitHeading = Math.atan2(exit.x - center.x, exit.z - center.z);
    const turn = Math.atan2(Math.sin(exitHeading - heading), Math.cos(exitHeading - heading));
    // Face into the next water leg; aiming across the full sector can point through an island.
    // Keep the opening broad on approach and preserve the finish channel's grid heading.
    const approach = points[(routeIndex - 18 + points.length) % points.length];
    const approachHeading = Math.atan2(center.x - approach.x, center.z - approach.z);
    const approachTurn = Math.atan2(
      Math.sin(heading - approachHeading),
      Math.cos(heading - approachHeading),
    );
    const adjustment = Math.max(-Math.PI / 12, Math.min(Math.PI / 12, turn));
    const angle =
      index === 0
        ? heading
        : approachHeading +
          Math.max(-Math.PI / 6, Math.min(Math.PI / 6, approachTurn + adjustment));
    return {
      ...fitGateToShore(
        { ...center, tx: Math.sin(angle), tz: Math.cos(angle), width },
        layout.land,
      ),
      name,
      routeIndex,
    };
  });
  const ramps: Ramp[] = layout.rampCenters.map(([x, z, tx = -1, tz = 0]) => {
    const early = d.id === 'palms' && tz === -1;
    const ramp = {
      x,
      z,
      tx,
      tz,
      width: early ? 9 : 12,
      length: d.id === 'palms' && !early ? 16 : 20,
      baseHeight: -4.2,
      height: d.id === 'palms' && !early ? 7.2 : 7,
    };
    const rampIndex = points.reduce(
      (best, p, i) =>
        Math.hypot(p.x - x, p.z - z) < Math.hypot(points[best].x - x, points[best].z - z)
          ? i
          : best,
      0,
    );
    const next = gates.findIndex((gate) => gate.routeIndex > rampIndex);
    return { ...ramp, targetGate: next < 0 ? 0 : next };
  });
  const landmark =
    d.id === 'storm'
      ? { x: 260, z: 130, tx: 0, tz: 1, width: 56 }
      : at(d.id === 'palms' ? 0.42 : 0.46);
  return {
    ...d,
    wave: d.id === 'palms' ? 0.8 : d.id === 'harbor' ? 0.95 : 1.25,
    waveZones: layout.zones,
    shore: createShoreField(layout.land),
    points,
    gates,
    ramps,
    land: layout.land,
    landmark,
    dolphin: at(d.id === 'harbor' ? 0.2 : 0.22),
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

/** Arc length of the route section that ends at this checkpoint. */
export function checkpointDistance(track: Track, next: number): number {
  const gate = track.gates[next],
    previous = track.gates[(next - 1 + track.gates.length) % track.gates.length];
  const end = gate.routeIndex ?? nearestPoint(track, gate),
    start = previous.routeIndex ?? nearestPoint(track, previous);
  return (
    (((end - start + track.points.length) % track.points.length || track.points.length) *
      track.length) /
    track.points.length
  );
}
