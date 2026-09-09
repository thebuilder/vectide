import { expect, it } from 'vitest';
import { CELL, vertexHeight, waterHeight, waveZoneWeight, type WaveZone } from '../src/game/water';

const zone: WaveZone = {
  name: 'reef swell',
  x: 0,
  z: 0,
  tx: 0,
  tz: -1,
  length: 180,
  width: 100,
  shelter: 0,
  swell: 2.4,
  wavelength: 28,
  speed: 5,
};
it('shelters a bay while leaving offshore water unchanged', () => {
  const sea = { wave: 1.2, waveZones: [{ ...zone, swell: 0, shelter: 0.9 }] };
  for (let time = 0; time < 10; time += 0.13) {
    expect(vertexHeight(0, 0, time, sea)).toBeCloseTo(vertexHeight(0, 0, time, 1.2) * 0.1, 10);
    expect(vertexHeight(500, 0, time, sea)).toBe(vertexHeight(500, 0, time, 1.2));
  }
});
it('creates local launch faces with smooth zone transitions on the actual mesh', () => {
  const sea = { wave: 1.2, waveZones: [zone] };
  let highest = 0,
    lowest = 0;
  for (let time = 0; time < 12; time += 0.1) {
    highest = Math.max(highest, waterHeight(0, 0, time, sea));
    lowest = Math.min(lowest, waterHeight(0, 0, time, sea));
  }
  expect(highest - lowest).toBeGreaterThan(5);
  for (let x = -52; x <= 52; x += CELL)
    for (let z = -92; z <= 92; z += CELL)
      expect(waterHeight(x, z, 1.3, sea)).toBeCloseTo(vertexHeight(x, z, 1.3, sea), 10);
  expect(waterHeight(48 - 1e-6, 0, 1.3, sea)).toBeCloseTo(waterHeight(48 + 1e-6, 0, 1.3, sea), 5);
  expect(waveZoneWeight(50, 0, zone)).toBe(0);
  expect(waveZoneWeight(50 - 1e-3, 0, zone)).toBeLessThan(1e-7);
});
