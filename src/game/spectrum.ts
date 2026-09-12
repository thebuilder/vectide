export interface Spectrum {
  low: number;
  mid: number;
  high: number;
}
export class MusicSpectrum {
  readonly bands: Spectrum = { low: 0, mid: 0, high: 0 };
  readonly waveform = new Float32Array(32);
  beat = 0;
  beatStrength = 0;
  private bassFloor = 0;
  private previousBass = 0;
  private cooldown = 0;
  private peaks: Spectrum = { low: 0.2, mid: 0.2, high: 0.2 };
  update(data: Uint8Array, hzPerBin: number, dt: number, playing: boolean, signal?: Uint8Array) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.beatStrength *= Math.exp(-dt * 5);
    for (const [key, from, to] of [
      ['low', 30, 180],
      ['mid', 180, 2000],
      ['high', 2000, 8000],
    ] as const) {
      const first = Math.max(1, Math.floor(from / hzPerBin)),
        last = Math.min(data.length - 1, Math.ceil(to / hzPerBin));
      let sum = 0;
      for (let i = first; i <= last; i++) sum += data[i];
      const raw = playing && last >= first ? sum / (last - first + 1) / 255 : 0;
      if (key === 'low') {
        // Only a rising bass transient accents the swells. Sustained notes never invent a tempo.
        if (
          raw > 0.12 &&
          raw > this.bassFloor * 1.12 + 0.025 &&
          raw - this.previousBass > 0.72 * dt &&
          this.cooldown === 0
        ) {
          this.beat++;
          this.beatStrength = Math.min(1, (raw - this.bassFloor) * 4 + 0.3);
          this.cooldown = 0.3;
        }
        this.bassFloor += (raw - this.bassFloor) * (1 - Math.exp(-dt * 3));
        this.previousBass = raw;
      }
      this.peaks[key] = Math.max(0.06, raw, this.peaks[key] * Math.exp(-dt / 12));
      const target = Math.min(1, Math.max(0, (raw / this.peaks[key] - 0.65) / 0.35));
      this.bands[key] +=
        (target - this.bands[key]) * (1 - Math.exp(-dt * (target > this.bands[key] ? 24 : 6)));
    }
    // Align at a rising zero crossing so the trace keeps its shape between audio frames.
    let start = 0;
    if (signal && playing) {
      for (let i = 1; i < Math.min(512, signal.length); i++) {
        if (signal[i - 1] < 128 && signal[i] >= 128) {
          start = i;
          break;
        }
      }
    }
    for (let i = 0; i < this.waveform.length; i++) {
      let sum = 0;
      for (let j = 0; j < 8; j++)
        sum += signal && playing ? ((signal[start + i * 8 + j] ?? 128) - 128) / 128 : 0;
      this.waveform[i] = sum / 8;
    }
    return this.bands;
  }
}
