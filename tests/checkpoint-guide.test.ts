import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { projectCheckpoint } from '../src/checkpoint-guide';
import { createWorld } from '../src/game/visuals';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

it('animates only the active gate marker and keeps reduced-motion markers still', () => {
  const track = TRACKS[0],
    world = createWorld(track),
    racer = createRacer(track, 0);
  world.update(0, racer);
  expect(world.gates[0].getObjectByName('next')!.visible).toBe(false);
  racer.nextGate = 1;
  const marker = world.gates[1].getObjectByName('next')!;
  world.update(0, racer);
  const first = marker.position.y;
  world.update(0.4, racer);
  expect(marker.position.y).not.toBe(first);
  world.update(1, racer, undefined, track, true);
  const still = marker.position.y;
  world.update(2, racer, undefined, track, true);
  expect(marker.position.y).toBe(still);
  racer.nextGate = 2;
  world.update(2, racer);
  expect(marker.visible).toBe(false);
  expect(world.gates[2].getObjectByName('next')!.visible).toBe(true);
  world.dispose();
});

for (const [width, height] of [
  [390, 844],
  [844, 390],
  [1280, 800],
]) {
  it(`keeps front, side, overhead and behind-camera gates inside ${width}x${height}`, () => {
    const camera = new PerspectiveCamera(60, width / height, 0.1, 6000);
    camera.updateMatrixWorld();
    const bounds = { left: 72, right: width - 72, top: 100, bottom: height - 130 };
    for (const target of [
      [0, 0, -100],
      [-500, 0, -20],
      [500, 0, -20],
      [0, 500, -20],
      [0, -500, -20],
      [-10, 0, 50],
      [10, 0, 50],
      [0, 0, 0],
    ]) {
      const result = projectCheckpoint(new Vector3(...target), camera, width, height, bounds);
      expect(result.x).toBeGreaterThanOrEqual(bounds.left - 0.001);
      expect(result.x).toBeLessThanOrEqual(bounds.right + 0.001);
      expect(result.y).toBeGreaterThanOrEqual(bounds.top - 0.001);
      expect(result.y).toBeLessThanOrEqual(bounds.bottom + 0.001);
      expect(Number.isFinite(result.angle)).toBe(true);
    }
    const left = projectCheckpoint(new Vector3(-10, 0, 50), camera, width, height, bounds);
    const right = projectCheckpoint(new Vector3(10, 0, 50), camera, width, height, bounds);
    expect(left.x).toBe(bounds.left);
    expect(right.x).toBe(bounds.right);
    expect(left.behind && right.behind).toBe(true);
    expect(left.outside && right.outside).toBe(true);
  });
}

it('projects a visible gate at its actual camera position instead of pinning every gate to the HUD', () => {
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 6000);
  camera.position.set(30, 10, 50);
  camera.lookAt(30, 10, -50);
  camera.updateMatrixWorld();
  const bounds = { left: 80, right: 1200, top: 100, bottom: 700 };
  const a = projectCheckpoint(new Vector3(30, 10, -50), camera, 1280, 800, bounds);
  const b = projectCheckpoint(new Vector3(40, 10, -50), camera, 1280, 800, bounds);
  expect(a.outside).toBe(false);
  expect(a.x).toBeCloseTo(640);
  expect(a.y).toBeCloseTo(400);
  expect(b.x).toBeGreaterThan(a.x);
});
