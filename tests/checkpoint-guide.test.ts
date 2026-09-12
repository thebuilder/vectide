import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { projectCheckpoint, checkpointInView } from '../src/checkpoint-guide';
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

it('treats gates inside the viewport but outside HUD margins as visible', () => {
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 6000);
  camera.updateMatrixWorld();
  const gate = { x: 80, z: -100, tx: 0, tz: 1, width: 40 };
  const target = new Vector3(gate.x, 6.5, gate.z);
  const projected = projectCheckpoint(target, camera, 1280, 800, {
    left: 200,
    right: 1080,
    top: 200,
    bottom: 600,
  });
  expect(projected.outside).toBe(true);
  expect(checkpointInView(gate, target, camera)).toBe(true);
});

it('keeps guidance quiet while part of the gate opening remains visible', () => {
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 6000);
  camera.updateMatrixWorld();
  const gate = { x: 105, z: -100, tx: 0, tz: 1, width: 40 };
  expect(new Vector3(gate.x, 6.5, gate.z).project(camera).x).toBeGreaterThan(1);
  expect(checkpointInView(gate, new Vector3(gate.x, 6.5, gate.z), camera)).toBe(true);
  gate.x = 150;
  expect(checkpointInView(gate, new Vector3(gate.x, 6.5, gate.z), camera)).toBe(false);
  gate.x = 0;
  gate.z = 50;
  expect(checkpointInView(gate, new Vector3(gate.x, 6.5, gate.z), camera)).toBe(false);
});

it('shows guidance when a diagonal gate is wholly outside the viewport', () => {
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 6000);
  camera.updateMatrixWorld();
  const gate = { x: 120, z: -100, tx: Math.SQRT1_2, tz: Math.SQRT1_2, width: 40 };
  for (const side of [-1, 1]) {
    const post = new Vector3(
      gate.x - (gate.tz * side * gate.width) / 2,
      6.5,
      gate.z + (gate.tx * side * gate.width) / 2,
    );
    expect(post.project(camera).x).toBeGreaterThan(1);
  }
  expect(checkpointInView(gate, new Vector3(gate.x, 6.5, gate.z), camera)).toBe(false);
});

it('does not mistake a pitched view past the side of a gate for a visible opening', () => {
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 6000);
  camera.lookAt(0, -5, -17);
  camera.updateMatrixWorld();
  const gate = { x: -30, z: -20, tx: 0.608761429, tz: -0.7933533403, width: 46 };
  expect(checkpointInView(gate, new Vector3(-30, -3.5, -20), camera)).toBe(false);
});

it('recognizes a close gate opening that contains the entire camera view', () => {
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 0.5);
  camera.position.set(0, 5, 0);
  camera.lookAt(0, 5, -1);
  camera.updateMatrixWorld();
  const gate = { x: 0, z: 0, tx: 0, tz: 1, width: 40 };
  expect(checkpointInView(gate, new Vector3(0, 6.5, 0), camera)).toBe(true);
});
