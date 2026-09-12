import type { MusicSpectrum } from './spectrum';

/** Slow modulation of existing surface highlights, with no illumination of the water body. */
export class MusicWater {
  readonly uniforms = {
    uMusicGlint: { value: 0 },
    uMusicWaveform: { value: new Float32Array(32) },
  };
  private previousTime?: number;
  update(time: number, music?: MusicSpectrum, enabled = true) {
    const dt = Math.max(0, Math.min(0.1, time - (this.previousTime ?? time - 1 / 60)));
    this.previousTime = time;
    if (!music || !enabled) {
      this.uniforms.uMusicGlint.value = 0;
      this.uniforms.uMusicWaveform.value.fill(0);
      return;
    }
    const target = music.bands.mid * 0.35 + music.bands.high * 0.65;
    this.uniforms.uMusicGlint.value +=
      (target - this.uniforms.uMusicGlint.value) * (1 - Math.exp(-dt * 3));
    this.uniforms.uMusicWaveform.value.set(music.waveform);
  }
}

export const musicWaterGLSL = `
  uniform float uMusicGlint;
  uniform float uMusicWaveform[32];
  float crestDetail(vec2 position) {
    float sampleAt=fract(dot(position,vec2(.39,-.92))*.018)*32.;
    int sampleIndex=int(floor(sampleAt));
    float signal=mix(uMusicWaveform[sampleIndex],uMusicWaveform[(sampleIndex+1)%32],fract(sampleAt));
    return .65+min(abs(signal)*6.,1.)*.35;
  }
`;
