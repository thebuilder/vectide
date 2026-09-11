import { it, expect } from 'vitest';
import { createDolphins } from '../src/game/dolphins';
import { TRACKS } from '../src/game/tracks';
import { polygonContact } from '../src/game/hull-contact';
import { waterHeight } from '../src/game/water';
import { createRacer } from '../src/game/physics';
it('breaches on approach, departs, and resets for another lap or race', () => {
  const track = TRACKS[0],
    pod = createDolphins(track),
    r = createRacer(track, 0);
  pod.update(0, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  Object.assign(r, track.dolphin);
  r.lap = 1;
  pod.update(10, r);
  pod.update(11, r);
  expect(pod.group.children.every((a) => a.visible)).toBe(true);
  pod.update(20, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  pod.update(21, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  r.lap = 2;
  pod.update(22, r);
  expect(pod.group.children[0].visible).toBe(true);
  pod.update(0, r);
  expect(pod.group.children[0].visible).toBe(true);
});

it.each(TRACKS.filter((track) => track.id !== 'storm'))(
  'keeps breaching dolphins clear of the racing line and shore on $name',
  (track) => {
    const pod = createDolphins(track),
      r = createRacer(track, 0);
    Object.assign(r, track.dolphin);
    pod.update(0, r);
    for (let frame = 0; frame < 4 * 60; frame++) {
      const t = frame / 60;
      pod.update(t, r);
      for (const animal of pod.group.children) {
        const { x, y, z } = animal.position;
        if (!animal.visible || y < waterHeight(x, z, t, track) - 1) continue;
        const clearance = Math.min(...track.points.map((p) => Math.hypot(x - p.x, z - p.z)));
        expect(clearance).toBeGreaterThan(12);
        const bounds = [
          { x: x - 2, z: z - 2 },
          { x: x + 2, z: z - 2 },
          { x: x + 2, z: z + 2 },
          { x: x - 2, z: z + 2 },
        ];
        for (const land of track.land)
          expect(polygonContact(bounds, land.outline), land.name).toBeNull();
      }
    }
  },
);

it('arches the spine through the jump without sharing pose state or moving fins off the body', async () => {
  const { Mesh, Vector3 } = await import('three');
  const { createDolphinModel } = await import('../src/game/dolphin-model');
  const { poseDolphin } = await import('../src/game/dolphin-pose');
  const rising = createDolphinModel();
  const diving = rising.clone();
  poseDolphin(rising, 0.2);
  poseDolphin(diving, 1.8);
  const body = rising.children[0] as InstanceType<typeof Mesh>;
  const other = diving.children[0] as InstanceType<typeof Mesh>;
  const center = (mesh: InstanceType<typeof Mesh>, row: number) => {
    const average = new Vector3();
    for (let i = 0; i < 20; i++) average.add(mesh.getVertexPosition(row * 20 + i, new Vector3()));
    return average.divideScalar(20);
  };
  expect(center(body, 0).y).toBeGreaterThan(0.15);
  expect(center(other, 0).y).toBeLessThan(-0.3);
  expect(center(other, 9).y).toBeLessThan(-0.35);
  expect(body.geometry).toBe(other.geometry);
  expect(body.morphTargetInfluences).not.toBe(other.morphTargetInfluences);
  // Every visible part uses the same bend, including the cloned mouth lines.
  for (const part of diving.children)
    expect((part as InstanceType<typeof Mesh>).morphTargetInfluences).toEqual(
      other.morphTargetInfluences,
    );
  const before = center(body, 0);
  poseDolphin(rising, 0.2);
  expect(center(body, 0).distanceTo(before)).toBe(0);
  poseDolphin(rising, 2.5 - 0.0001);
  const reentry = center(body, 0);
  poseDolphin(rising, 2.5 + 0.0001);
  expect(center(body, 0).distanceTo(reentry)).toBeLessThan(0.001);
});
