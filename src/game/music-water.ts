import type { MusicSpectrum } from './spectrum';

/** Audio light on the ocean's own swells; independent of rider position and water physics. */
export class MusicWater {
  readonly uniforms = {
    uMusicBeat: { value: 0 },
    uMusicWaveform: { value: new Float32Array(32) },
  };
  update(music?: MusicSpectrum, enabled = true) {
    this.uniforms.uMusicBeat.value = enabled ? (music?.beatStrength ?? 0) : 0;
    if (music && enabled) this.uniforms.uMusicWaveform.value.set(music.waveform);
    else this.uniforms.uMusicWaveform.value.fill(0);
  }
}

export const musicWaterGLSL = `
  uniform float uMusicBeat;
  uniform float uMusicWaveform[32];
  float crestDetail(vec2 position) {
    // Sample along the dominant swell's crest. Audio adds broken detail to that swell,
    // never an expanding ring, separate stripe or new surface displacement.
    float sampleAt=fract(dot(position,vec2(.39,-.92))*.018)*32.;
    int sampleIndex=int(floor(sampleAt));
    float signal=mix(uMusicWaveform[sampleIndex],uMusicWaveform[(sampleIndex+1)%32],fract(sampleAt));
    return .65+min(abs(signal)*6.,1.)*.35;
  }
`;
