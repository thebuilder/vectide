import { expect, it } from 'vitest';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { addTerrain } from '../src/game/terrain-visuals';
import { addLandmarks } from '../src/game/landmarks';
import { gatePointClear } from '../src/game/course-layout';
import { shoreDistance } from '../src/game/shore';
import { TRACKS } from '../src/game/tracks';

it('keeps the shaped arch banks convex for hull collision', () => {
  for (const land of TRACKS[0].land.filter((land) =>
    ['Outer island', 'Reef headland'].includes(land.name),
  )) {
    const points = land.outline;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        c = points[(i + 2) % points.length];
      expect((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x), land.name).toBeGreaterThan(0);
    }
  }
});

it('grounds both Palm arch supports on dry terrain while leaving a broad water channel', () => {
  const track = TRACKS[0];
  const world = new Group();
  addTerrain(world, track);
  addLandmarks(world, track);
  world.updateMatrixWorld(true);
  const terrain = world.children.filter((object) => object.name.startsWith('Terrain: '));
  const arch = world.getObjectByName('Tower bridge')!;
  let supports = 0;
  arch.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.attributes.position;
    let grounded = false;
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (p.y >= 0) continue;
      grounded = true;
      const hit = new Raycaster(new Vector3(p.x, 30, p.z), new Vector3(0, -1, 0)).intersectObjects(
        terrain,
        false,
      )[0];
      expect(hit, `Missing bank beneath arch at ${p.x}, ${p.z}`).toBeDefined();
      expect(hit.point.y).toBeGreaterThan(0.45);
      expect(shoreDistance(p.x, p.z, track.shore)).toBeLessThan(-1);
    }
    if (grounded) supports++;
  });
  expect(supports).toBe(2);
  const gate = track.landmark;
  // This includes the shore slope and a passing-hull margin on both sides.
  for (let side = -12; side <= 12; side += 1)
    expect(
      gatePointClear(gate.x + gate.tz * side, gate.z - gate.tx * side, track.land),
      `Arch opening at ${side} m across`,
    ).toBe(true);
});

it.each(TRACKS)(
  'anchors palms and island buildings to the actual faceted terrain on $name',
  (track) => {
    const world = new Group();
    addTerrain(world, track);
    world.updateMatrixWorld(true);
    for (const land of track.land.filter((l) => l.kind === 'island')) {
      const shore = world.getObjectByName(`Terrain: ${land.name}`)!;
      expect(world.getObjectByName(`Hill: ${land.name}`)).toBeUndefined();
      const trees = world.children.filter(
        (o) => o.name === 'Palm' && o.userData.land === land.name,
      );
      expect(trees.length).toBeGreaterThanOrEqual(6);
      for (const tree of trees) {
        const hit = new Raycaster(
          new Vector3(tree.position.x, 30, tree.position.z),
          new Vector3(0, -1, 0),
        ).intersectObject(shore)[0];
        expect(hit).toBeDefined();
        expect(tree.position.y).toBeCloseTo(hit.point.y, 5);
        expect(tree.position.y).toBeLessThanOrEqual(land.height);
      }
      if (land.name !== 'Lookout point') continue;
      const resort = world.getObjectByName('Reef lookout resort')!;
      expect(resort.position.y).toBe(land.height);
      resort.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const points = object.geometry.attributes.position;
        for (let i = 0; i < points.count; i++) {
          const p = new Vector3().fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld);
          const hit = new Raycaster(
            new Vector3(p.x, 30, p.z),
            new Vector3(0, -1, 0),
          ).intersectObject(shore)[0];
          expect(hit, `Missing support at ${p.x}, ${p.z}`).toBeDefined();
          expect(hit.point.y).toBeCloseTo(land.height, 5);
        }
      });
    }
  },
);

it('removes the obsolete fixed-coordinate Palm turn sign', () => {
  const world = new Group();
  addTerrain(world, TRACKS[0]);
  expect(world.getObjectByName('Lagoon left turn chevrons')).toBeUndefined();
});
