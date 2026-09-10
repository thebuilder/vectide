import { expect, test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { checkpointPosition } from '../src/checkpoint';

const camera = new PerspectiveCamera(60, 1.6, 0.1, 1000);
camera.updateMatrixWorld();

test('anchors a visible gate above its projected center', () => {
  const marker = checkpointPosition(camera, new Vector3(0, 0, -30), 1280, 800);
  expect(marker).toEqual({ x: 640, y: 370, angle: Math.PI, offscreen: false });
});

for (const side of [-1, 1]) {
  test(`points toward an offscreen gate on side ${side}, even behind the camera`, () => {
    for (const z of [-30, 0, 30]) {
      const marker = checkpointPosition(camera, new Vector3(side * 100, 0, z), 1280, 800);
      expect(marker.offscreen).toBe(true);
      expect(marker.x).toBe(side < 0 ? 78 : 1202);
      expect(marker.angle).toBeCloseTo((side * Math.PI) / 2);
    }
  });
}

test('keeps guidance within the driving view at narrow and short sizes', () => {
  for (const [width, height] of [
    [360, 780],
    [844, 390],
  ]) {
    for (const x of [-100, 0, 100])
      for (const y of [-100, 0, 100]) {
        const marker = checkpointPosition(camera, new Vector3(x, y, -1), width, height);
        expect(marker.x).toBeGreaterThanOrEqual(78);
        expect(marker.x).toBeLessThanOrEqual(width - 78);
        expect(marker.y).toBeGreaterThanOrEqual(Math.min(225, height * 0.55));
        expect(marker.y).toBeLessThanOrEqual(height * 0.64);
        expect(Number.isFinite(marker.angle)).toBe(true);
      }
  }
});
