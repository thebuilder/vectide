import { expect, it } from 'vitest';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { TRACKS, nearestPoint } from '../src/game/tracks';
import { islandGeometry } from '../src/game/island-geometry';
import { polygonContact } from '../src/game/hull-contact';
import { addLandmarks } from '../src/game/landmarks';

const track = TRACKS[0];

it('closes the misleading passage between the inner islands', () => {
  for (const z of [40, 65, 90, 115]) {
    const hull = [
      { x: 109, z: z - 1 },
      { x: 111, z: z - 1 },
      { x: 111, z: z + 1 },
      { x: 109, z: z + 1 },
    ];
    expect(track.land.some((land) => polygonContact(hull, land.outline))).toBe(true);
  }
});

it('screens the jump ramps from the early inner-island approach with actual terrain', () => {
  const land = track.land.find((land) => land.name === 'Outer island')!;
  const mesh = new Mesh(
    islandGeometry(land, track.land.indexOf(land)),
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  mesh.updateMatrixWorld();
  const eye = new Vector3(105, 4, -3);
  for (const ramp of track.ramps.slice(0, 2)) {
    for (const side of [-1, 0, 1]) {
      const top = new Vector3(
        ramp.x + (ramp.tx * ramp.length) / 2 - (ramp.tz * side * ramp.width) / 2,
        ramp.height,
        ramp.z + (ramp.tz * ramp.length) / 2 + (ramp.tx * side * ramp.width) / 2,
      );
      const delta = top.clone().sub(eye);
      expect(
        new Raycaster(eye, delta.clone().normalize(), 0, delta.length()).intersectObject(mesh)
          .length,
        `Ramp at ${ramp.x}, side ${side}`,
      ).toBeGreaterThan(0);
    }
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
});

it('faces the tower bridge toward its approach and keeps visual supports on their collision centers', () => {
  const g = track.landmark,
    approach = track.points[nearestPoint(track, { x: 150, z: 4 })];
  const dx = g.x - approach.x,
    dz = g.z - approach.z;
  expect((dx * g.tx + dz * g.tz) / Math.hypot(dx, dz)).toBeGreaterThan(0.995);
  const group = new Group();
  addLandmarks(group, track);
  group.updateMatrixWorld(true);
  const bridge = group.getObjectByName('Tower bridge')!;
  for (const [i, side] of [-37, 37].entries()) {
    const base = bridge.localToWorld(new Vector3(side, 0, 0));
    expect(base.x).toBeCloseTo(track.obstacles[i].x);
    expect(base.z).toBeCloseTo(track.obstacles[i].z);
    expect(
      Math.min(...track.points.map((p) => Math.hypot(p.x - base.x, p.z - base.z))) -
        track.obstacles[i].radius,
    ).toBeGreaterThan(18);
  }
});
