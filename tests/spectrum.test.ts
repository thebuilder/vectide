import { it, expect } from 'vitest';
import { MusicSpectrum } from '../src/game/spectrum';
it('separates frequency bands and fades to silence without invented beats', () => {
  const spectrum = new MusicSpectrum(),
    data = new Uint8Array(1024);
  data.fill(200, 2, 8);
  for (let i = 0; i < 30; i++) spectrum.update(data, 48000 / 2048, 1 / 60, true);
  expect(spectrum.bands.low).toBeGreaterThan(0.8);
  expect(spectrum.bands.mid).toBe(0);
  expect(spectrum.bands.high).toBe(0);
  for (let i = 0; i < 120; i++) spectrum.update(data, 48000 / 2048, 1 / 60, false);
  expect(spectrum.bands.low).toBeLessThan(0.001);
});
