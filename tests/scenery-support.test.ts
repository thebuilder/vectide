import { expect, it } from 'vitest';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { addTerrain } from '../src/game/terrain-visuals';
import { TRACKS } from '../src/game/tracks';

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
