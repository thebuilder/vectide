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

it('detects bass attacks without repeating a sustained tone or emitting on silence', () => {
  const spectrum = new MusicSpectrum(),
    data = new Uint8Array(1024);
  const update = (level: number, frames: number, playing = true) => {
    data.fill(level, 1, 9);
    for (let i = 0; i < frames; i++) spectrum.update(data, 48000 / 2048, 1 / 60, playing);
  };
  update(0, 60);
  expect(spectrum.beat).toBe(0);
  update(220, 180);
  expect(spectrum.beat).toBe(1);
  update(0, 60);
  update(230, 1);
  expect(spectrum.beat).toBe(2);
  expect(spectrum.beatStrength).toBeGreaterThan(0.5);
  update(230, 120, false);
  expect(spectrum.beat).toBe(2);
  expect(spectrum.beatStrength).toBeLessThan(0.001);
});

it('captures real waveform samples and clears them when music stops', () => {
  const spectrum = new MusicSpectrum(),
    signal = new Uint8Array(2048).fill(192);
  spectrum.update(new Uint8Array(1024), 24, 1 / 60, true, signal);
  expect([...spectrum.waveform]).toEqual(Array(32).fill(0.5));
  spectrum.update(new Uint8Array(1024), 24, 1 / 60, false, signal);
  expect([...spectrum.waveform]).toEqual(Array(32).fill(0));
});

it.each([30, 60, 120])('detects the same gradual bass attacks at %i frames per second', (fps) => {
  const spectrum = new MusicSpectrum(),
    data = new Uint8Array(1024),
    dt = 1 / fps;
  for (let frame = 0; frame < fps * 3; frame++) {
    const phase = (frame / fps) % 1;
    data.fill(Math.round(255 * Math.min(phase / 0.3, 1) * 0.8), 1, 9);
    spectrum.update(data, 48000 / 2048, dt, true);
  }
  expect(spectrum.beat).toBe(3);
});
