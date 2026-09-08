export interface Spectrum {
  low: number;
  mid: number;
  high: number;
}
export class MusicSpectrum {
  readonly bands: Spectrum = { low: 0, mid: 0, high: 0 };
  private peaks: Spectrum = { low: 0.2, mid: 0.2, high: 0.2 };
  update(data: Uint8Array, hzPerBin: number, dt: number, playing: boolean) {
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
      this.peaks[key] = Math.max(0.06, raw, this.peaks[key] * Math.exp(-dt / 12));
      const target = Math.min(1, Math.max(0, (raw / this.peaks[key] - 0.65) / 0.35));
      this.bands[key] +=
        (target - this.bands[key]) * (1 - Math.exp(-dt * (target > this.bands[key] ? 24 : 6)));
    }
    return this.bands;
  }
}
