import { expect, it } from 'vitest';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { addTerrain } from '../src/game/terrain-visuals';
import { TRACKS } from '../src/game/tracks';

it.each(TRACKS)(
  'keeps island buildings and hills supported by the visible terrain on $name',
  (track) => {
    const world = new Group();
    addTerrain(world, track);
    world.updateMatrixWorld(true);
    for (const land of track.land.filter((land) => land.kind === 'island')) {
      const shore = world.getObjectByName(`Terrain: ${land.name}`)!;
      const decoration = world.getObjectByName(
        land.name === 'Lookout point' ? 'Reef lookout resort' : `Hill: ${land.name}`,
      )!;
      expect(decoration).toBeDefined();
      if (land.name === 'Lookout point') {
        expect(decoration.position.y).toBe(land.height);
        expect(world.getObjectByName(`Hill: ${land.name}`)).toBeUndefined();
      }
      decoration.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const points = object.geometry.getAttribute('position');
        for (let i = 0; i < points.count; i++) {
          const p = new Vector3().fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld);
          const hits = new Raycaster(
            new Vector3(p.x, land.height + 100, p.z),
            new Vector3(0, -1, 0),
          ).intersectObject(shore);
          expect(
            hits.length,
            `${land.name} does not support decoration at ${p.x}, ${p.z}`,
          ).toBeGreaterThan(0);
          expect(hits[0].point.y).toBeCloseTo(land.height, 5);
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
