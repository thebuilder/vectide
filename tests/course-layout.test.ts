import { gatePointClear } from '../src/game/course-layout';
import { expect, it } from 'vitest';
import { Mesh } from 'three';
import { TRACKS } from '../src/game/tracks';
import { createWorld } from '../src/game/visuals';
import { createRacer, stepRacer } from '../src/game/physics';
import { waterHeight } from '../src/game/water';
import { hullPoints, polygonContact } from '../src/game/hull-contact';

it.each(TRACKS)('owns stable terrain collision data before rendering $name', (track) => {
  const before = JSON.stringify({ land: track.land, obstacles: track.obstacles });
  const world = createWorld(track);
  expect(JSON.stringify({ land: track.land, obstacles: track.obstacles })).toBe(before);
  expect(track.land.length).toBeGreaterThan(4);
  let colored = 0;
  world.group.traverse((o) => {
    if (o instanceof Mesh && !Array.isArray(o.material) && o.material.vertexColors) {
      colored++;
      expect(o.geometry.getAttribute('color')).toBeDefined();
    }
  });
  expect(colored).toBeGreaterThan(0);
  world.dispose();
});
it.each(TRACKS)('leaves the navigation line clear of authored shores on $name', (track) => {
  const r = createRacer(track, 0);
  for (let i = 0; i < track.points.length; i += 3) {
    const p = track.points[i],
      q = track.points[(i + 1) % track.points.length];
    Object.assign(r, { x: p.x, z: p.z, yaw: Math.atan2(q.x - p.x, q.z - p.z) });
    for (const land of track.land)
      expect(
        polygonContact(hullPoints(r), land.outline),
        `${land.name} at route point ${i}`,
      ).toBeNull();
  }
});
it.each(TRACKS.filter((track) => track.ramps.length > 0))(
  'can chain both ramps and settle between them on $name',
  (track) => {
    const first = track.ramps[0],
      r = createRacer(track, 0);
    Object.assign(r, {
      x: first.x - first.tx * 30,
      z: first.z - first.tz * 30,
      yaw: Math.atan2(first.tx, first.tz),
      vx: first.tx * 22,
      vz: first.tz * 22,
    });
    r.y = waterHeight(r.x, r.z, 0, track) + 0.5;
    const touched = new Set<number>();
    let waterBetween = false;
    for (let f = 0; f < 120 * 13; f++) {
      stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, f / 120, 1 / 120);
      if (r.onRamp)
        track.ramps.forEach((ramp, i) => {
          if (Math.hypot(r.x - ramp.x, r.z - ramp.z) < ramp.length / 2 + 1) touched.add(i);
        });
      if (
        touched.has(0) &&
        !touched.has(1) &&
        !r.onRamp &&
        r.wet > 0 &&
        r.x < first.x - first.length / 2
      )
        waterBetween = true;
    }
    expect([...touched]).toEqual([0, 1]);
    expect(waterBetween).toBe(true);
  },
);
it('keeps Palm entirely tropical', () => {
  expect(TRACKS[0].land.every((land) => land.kind === 'island')).toBe(true);
});

it('connects the inner Port quays with continuous dry dock surface', () => {
  const track = TRACKS[1];
  for (const [from, to] of [
    [
      [17.1, -38.25],
      [74.25, -83.25],
    ],
    [
      [74.25, -83.25],
      [98.1, 45],
    ],
    [
      [98.1, 45],
      [12, 74],
    ],
    [
      [98.1, 73],
      [193.5, 73],
    ],
  ]) {
    const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]));
    for (let step = 0; step <= steps; step++) {
      const x = from[0] + ((to[0] - from[0]) * step) / steps;
      const z = from[1] + ((to[1] - from[1]) * step) / steps;
      const footprint = [
        { x: x - 0.01, z: z - 0.01 },
        { x: x + 0.01, z: z - 0.01 },
        { x: x + 0.01, z: z + 0.01 },
        { x: x - 0.01, z: z + 0.01 },
      ];
      expect(
        track.land.some((land) => polygonContact(footprint, land.outline)),
        `open water between inner quays at ${x}, ${z}`,
      ).toBe(true);
    }
  }
});

it('keeps all twelve Port grid slots clear of the connected dock and finish divider', () => {
  const track = TRACKS[1];
  for (let slot = 0; slot < 12; slot++) {
    const racer = createRacer(track, slot);
    expect(gatePointClear(racer.x, racer.z, track.land), `grid slot ${slot}`).toBe(true);
  }
});

it.each(TRACKS)('keeps the whole checkpoint opening clear of shore on $name', (track) => {
  for (const gate of track.gates) {
    expect(gate.width).toBeGreaterThanOrEqual(12);
    for (let offset = -gate.width / 2; offset <= gate.width / 2; offset += 0.5) {
      expect(gatePointClear(gate.x - gate.tz * offset, gate.z + gate.tx * offset, track.land)).toBe(
        true,
      );
    }
  }
});

it('floats each Storm buoy on its own wave and keeps its light above the water', () => {
  const track = TRACKS[2],
    world = createWorld(track),
    player = createRacer(track, 0);
  for (const time of [0, 3, 9, 20]) {
    world.update(time, player);
    for (const gate of world.gates) {
      for (const buoy of gate.children.filter((child) => child.name === 'buoy')) {
        const surface = waterHeight(
          gate.position.x + buoy.position.x,
          gate.position.z + buoy.position.z,
          time,
          track,
        );
        expect(gate.position.y + buoy.position.y).toBeCloseTo(surface);
        expect(buoy.children[2].position.y).toBeGreaterThanOrEqual(6);
      }
    }
  }
  world.dispose();
});

it('keeps Storm’s signal platform offshore and clear of the driving view through the weave', () => {
  const track = TRACKS[2],
    platform = track.obstacles[0];
  expect(platform.x - platform.radius).toBeGreaterThan(
    Math.max(...track.points.map((point) => point.x)) + 75,
  );
});

it('keeps all ten Storm grid positions clear of the island after rotating the start', () => {
  const track = TRACKS[2];
  for (let slot = 0; slot < 10; slot++) {
    const racer = createRacer(track, slot);
    for (const land of track.land)
      expect(
        polygonContact(hullPoints(racer), land.outline),
        `slot ${slot} at ${land.name}`,
      ).toBeNull();
  }
});
