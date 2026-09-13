import { expect, it } from 'vitest';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { gatePointClear } from '../src/game/course-layout';
import { addTerrain } from '../src/game/terrain-visuals';
import { addCourseGuidance } from '../src/game/course-guidance';
import { createRacer, stepRacer, updateProgress } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { waterHeight, waveZoneWeight } from '../src/game/water';

const port = TRACKS[1];
const storm = TRACKS[2];

it('closes the false straight-ahead channel beyond the Port inner-basin gate', () => {
  const gate = port.gates.find((gate) => gate.name === 'Inner basin')!;
  for (const side of [-8, 0, 8]) {
    const ahead = {
      x: gate.x + gate.tx * 60 - gate.tz * side,
      z: gate.z + gate.tz * 60 + gate.tx * side,
    };
    expect(gatePointClear(ahead.x, ahead.z, port.land)).toBe(false);
  }
  const next = port.gates.find((gate) => gate.name === 'Harbor mouth')!;
  for (let i = gate.routeIndex!; i <= next.routeIndex!; i++) {
    const point = port.points[i];
    expect(gatePointClear(point.x, point.z, port.land), `turn route point ${i}`).toBe(true);
  }
});

it('shows the Port turn board above the quay before reaching the checkpoint', () => {
  const world = new Group();
  addTerrain(world, port);
  addCourseGuidance(world, port);
  world.updateMatrixWorld(true);
  const sign = world.getObjectByName('Inner basin left-turn board')!;
  const gate = port.gates.find((gate) => gate.name === 'Inner basin')!;
  const eye = new Vector3(gate.x - gate.tx * 25, 3.5, gate.z - gate.tz * 25);
  const target = sign.localToWorld(new Vector3(0, 5, 0));
  const meshes: Mesh[] = [];
  world.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  const hit = new Raycaster(eye, target.sub(eye).normalize()).intersectObjects(meshes, false)[0];
  expect(hit).toBeDefined();
  let object = hit.object;
  while (object.parent && object !== sign) object = object.parent;
  expect(object).toBe(sign);
});

it('puts Storm’s first checkpoint directly ahead, before the large wave train', () => {
  const [start, first] = storm.gates;
  const distance = Math.hypot(first.x - start.x, first.z - start.z);
  expect(
    ((first.x - start.x) * start.tx + (first.z - start.z) * start.tz) / distance,
  ).toBeGreaterThan(0.999);
  expect(start.tx * first.tx + start.tz * first.tz).toBeGreaterThan(0.999);
  const waves = storm.waveZones!.filter((zone) => zone.swell > 0);
  for (let side = -first.width / 2; side <= first.width / 2; side++) {
    const x = first.x - first.tz * side;
    const z = first.z + first.tx * side;
    expect(Math.max(...waves.map((zone) => waveZoneWeight(x, z, zone)))).toBeLessThan(0.1);
  }
  const westWaves = waves.find((zone) => zone.name === 'West wave train')!;
  expect(
    Math.max(
      ...storm.points
        .slice(first.routeIndex!, storm.gates[2].routeIndex!)
        .map((point) => waveZoneWeight(point.x, point.z, westWaves)),
    ),
  ).toBeGreaterThan(0.8);
});

it.each([0, 5, 12])(
  'lets all twelve Storm grid slots reach the first checkpoint without steering at wave phase %s',
  (phase) => {
    for (let slot = 0; slot < 12; slot++) {
      const racer = createRacer(storm, slot);
      racer.y = waterHeight(racer.x, racer.z, phase, storm) + 0.6;
      for (let frame = 0; frame < 120 * 15 && racer.passed < 2; frame++) {
        const previous = { x: racer.x, z: racer.z };
        const time = phase + frame / 120;
        stepRacer(racer, { throttle: 1, steer: 0, brake: 0, lean: 0 }, storm, time, 1 / 120);
        updateProgress(racer, previous, storm, time, 1);
      }
      expect(racer.passed, `slot ${slot}`).toBe(2);
      expect(racer.recovery.crashes, `slot ${slot}`).toBe(0);
      expect(racer.recovered, `slot ${slot}`).toBe(false);
    }
  },
);
