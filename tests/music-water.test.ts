import { expect, it } from 'vitest';
import { MusicWater } from '../src/game/music-water';
import { MusicSpectrum } from '../src/game/spectrum';

it('limits a sudden audio attack to a gentle highlight change and clears on disable', () => {
  const water = new MusicWater(),
    music = new MusicSpectrum(),
    buffer = water.uniforms.uMusicWaveform.value;
  music.bands.high = 1;
  music.bands.mid = 1;
  music.beatStrength = 1;
  music.waveform[4] = 0.6;
  water.update(0, music);
  expect(water.uniforms.uMusicGlint.value).toBeGreaterThan(0);
  expect(water.uniforms.uMusicGlint.value).toBeLessThan(0.05);
  expect(buffer[4]).toBeCloseTo(0.6);
  for (let i = 1; i < 60; i++) water.update(i / 60, music);
  expect(water.uniforms.uMusicGlint.value).toBeGreaterThan(0.9);
  expect(water.uniforms.uMusicGlint.value).toBeLessThan(1);
  expect(water.uniforms.uMusicWaveform.value).toBe(buffer);
  water.update(1, music, false);
  expect(water.uniforms.uMusicGlint.value).toBe(0);
  expect([...buffer]).toEqual(Array(32).fill(0));
});

it.each([30, 60, 120])('filters the same musical envelope at %i fps', (fps) => {
  const water = new MusicWater(),
    music = new MusicSpectrum();
  water.update(0, music);
  music.bands.mid = 1;
  music.bands.high = 1;
  for (let i = 1; i <= fps; i++) water.update(i / fps, music);
  expect(water.uniforms.uMusicGlint.value).toBeCloseTo(1 - Math.exp(-3), 8);
  water.update(2);
  expect(water.uniforms.uMusicGlint.value).toBe(0);
});
