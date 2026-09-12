import { it, expect, vi } from 'vitest';
import { VoxelSpray } from '../src/game/spray';
import { createDolphins } from '../src/game/dolphins';
import { TRACKS } from '../src/game/tracks';
import { polygonContact } from '../src/game/hull-contact';
import { waterHeight } from '../src/game/water';
import { aiInput, createRacer, stepRacer, updateProgress } from '../src/game/physics';
it('breaches on approach, departs, and resets for another lap or race', () => {
  const track = TRACKS[0],
    pod = createDolphins(track),
    r = createRacer(track, 0);
  pod.update(0, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  Object.assign(r, track.dolphin, { vx: track.dolphin.tx * 20, vz: track.dolphin.tz * 20 });
  r.lap = 1;
  pod.update(10, r);
  pod.update(11, r);
  expect(pod.group.children.every((a) => a.visible)).toBe(true);
  pod.update(30, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  pod.update(31, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  r.lap = 2;
  pod.update(32, r);
  expect(pod.group.children[0].visible).toBe(true);
  pod.update(0, r);
  expect(pod.group.children[0].visible).toBe(true);
});

it.each(TRACKS.filter((track) => track.id !== 'storm'))(
  'makes short, staggered breaches beside a moving rider, clear of shore on $name',
  (track) => {
    const pod = createDolphins(track),
      r = createRacer(track, 0);
    pod.update(0, r);
    const initial = pod.group.children.map(() => null as null | { x: number; z: number });
    const previousPositions = pod.group.children.map(() => null as null | { x: number; z: number });
    const firstBreach = [-1, -1, -1];
    const airFrames = [0, 0, 0];
    const longestBreach = [0, 0, 0];
    for (let frame = 0; frame < 30 * 60; frame++) {
      const t = frame / 60;
      const previous = { x: r.x, z: r.z };
      stepRacer(r, aiInput(r, track, [r]), track, t, 1 / 60);
      updateProgress(r, previous, track, t, 1);
      pod.update(t, r);
      for (const [i, animal] of pod.group.children.entries()) {
        const { x, y, z } = animal.position;
        if (animal.visible && previousPositions[i]) {
          expect(Math.hypot(x - previousPositions[i]!.x, z - previousPositions[i]!.z)).toBeLessThan(
            0.51,
          );
        }
        if (animal.visible) previousPositions[i] = { x, z };
        if (animal.visible && !initial[i]) {
          initial[i] = { x, z };
          expect(y).toBeLessThan(waterHeight(x, z, t, track) - 2);
          expect(Math.hypot(x - r.x, z - r.z)).toBeGreaterThan(30);
        }
        if (animal.visible && y > waterHeight(x, z, t, track)) {
          if (firstBreach[i] < 0) firstBreach[i] = frame;
          longestBreach[i] = Math.max(longestBreach[i], ++airFrames[i]);
        } else airFrames[i] = 0;
        if (!animal.visible || y < waterHeight(x, z, t, track) - 0.5) continue;
        const clearance = Math.hypot(x - r.x, z - r.z);
        expect(clearance).toBeGreaterThan(6);
        expect(clearance).toBeLessThan(40);
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
    expect(firstBreach.every((frame) => frame >= 0)).toBe(true);
    expect(Math.max(...firstBreach) - Math.min(...firstBreach)).toBeGreaterThan(24);
    expect(longestBreach.every((frames) => frames > 5 && frames < 72)).toBe(true);
    pod.group.children.forEach((animal, i) => {
      expect(initial[i]).not.toBeNull();
      expect(
        Math.hypot(animal.position.x - initial[i]!.x, animal.position.z - initial[i]!.z),
      ).toBeGreaterThan(50);
    });
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
  // A one-second breach must complete the same bend cycle as the original slower pose.
  const slowPose = other.morphTargetInfluences!.slice();
  poseDolphin(diving, 1.8 / 2.5, 1);
  other.morphTargetInfluences!.forEach((weight, i) => expect(weight).toBeCloseTo(slowPose[i]));
  expect(center(other, 0).y).toBeLessThan(-0.3);
  const before = center(body, 0);
  poseDolphin(rising, 0.2);
  expect(center(body, 0).distanceTo(before)).toBe(0);
  poseDolphin(rising, 2.5 - 0.0001);
  const reentry = center(body, 0);
  poseDolphin(rising, 2.5 + 0.0001);
  expect(center(body, 0).distanceTo(reentry)).toBeLessThan(0.001);
});

it('leaves swimming foam and splashes at actual takeoff and re-entry', () => {
  const burst = vi.spyOn(VoxelSpray.prototype, 'burst');
  const foam = vi.spyOn(VoxelSpray.prototype, 'foamTrail');
  try {
    const track = TRACKS[0],
      pod = createDolphins(track),
      r = createRacer(track, 0);
    Object.assign(r, track.dolphin, { vx: track.dolphin.tx * 20, vz: track.dolphin.tz * 20 });
    pod.update(0, r);
    expect(foam).not.toHaveBeenCalled();
    expect(burst).not.toHaveBeenCalled();
    for (let frame = 0; frame < 180; frame++) {
      r.x += r.vx / 60;
      r.z += r.vz / 60;
      pod.update(frame / 60, r);
    }
    expect(foam).toHaveBeenCalled();
    expect(burst.mock.calls.some((call) => call[3] === 0.08)).toBe(true);
    expect(burst.mock.calls.some((call) => call[3] === 0.15)).toBe(true);
    expect(pod.waterEffects.instanceMatrix.count).toBe(384);
    const count = burst.mock.calls.length;
    for (let frame = 1800; frame < 1980; frame++) pod.update(frame / 60, r);
    expect(burst.mock.calls.length).toBe(count);
  } finally {
    vi.restoreAllMocks();
  }
});

it('drives swimming with the tail while keeping the head steady', async () => {
  const { Mesh, Vector3 } = await import('three');
  const { createDolphinModel } = await import('../src/game/dolphin-model');
  const { poseDolphin } = await import('../src/game/dolphin-pose');
  const model = createDolphinModel(),
    body = model.children[0] as InstanceType<typeof Mesh>;
  poseDolphin(model, 4, 1, 0);
  const nose = body.getVertexPosition(9 * 20, new Vector3());
  const tail = body.getVertexPosition(0, new Vector3());
  poseDolphin(model, 4, 1, Math.PI / 2);
  expect(body.getVertexPosition(9 * 20, new Vector3()).distanceTo(nose)).toBeLessThan(0.001);
  expect(body.getVertexPosition(0, new Vector3()).distanceTo(tail)).toBeGreaterThan(0.1);
});
