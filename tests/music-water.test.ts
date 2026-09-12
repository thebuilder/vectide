import { expect, it } from 'vitest';
import { MusicWater } from '../src/game/music-water';
import { MusicSpectrum } from '../src/game/spectrum';

it('copies real audio into a fixed uniform buffer with no rider or timing dependency', () => {
  const water = new MusicWater(),
    music = new MusicSpectrum();
  const buffer = water.uniforms.uMusicWaveform.value;
  music.beatStrength = 0.8;
  music.waveform[4] = 0.6;
  water.update(music);
  expect(water.uniforms.uMusicBeat.value).toBe(0.8);
  expect(buffer[4]).toBeCloseTo(0.6);
  music.waveform[4] = -0.3;
  water.update(music);
  expect(water.uniforms.uMusicWaveform.value).toBe(buffer);
  expect(buffer[4]).toBeCloseTo(-0.3);
  expect(buffer).toHaveLength(32);
});

it('clears beat and waveform on silence or reduced motion without retaining an old pulse', () => {
  const water = new MusicWater(),
    music = new MusicSpectrum();
  music.beatStrength = 1;
  music.waveform.fill(0.4);
  for (const enabled of [true, false, true]) {
    water.update(music, enabled);
    expect(water.uniforms.uMusicBeat.value).toBe(enabled ? 1 : 0);
    expect(water.uniforms.uMusicWaveform.value[0]).toBeCloseTo(enabled ? 0.4 : 0);
  }
  water.update();
  expect(water.uniforms.uMusicBeat.value).toBe(0);
  expect([...water.uniforms.uMusicWaveform.value]).toEqual(Array(32).fill(0));
});
