/** Short synthesized cues share one noise buffer and the sounds volume bus. */
export class SoundEffects {
  readonly noise: AudioBuffer;
  private explosionNoise?: AudioBuffer;
  private effects = new Set<GainNode>();
  constructor(
    private context: BaseAudioContext,
    private destination: AudioNode,
  ) {
    this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  pickup() {
    for (const [i, frequency] of [660, 990, 1320].entries())
      this.note(frequency, frequency, 0.18, 0.055, i * 0.055, 'triangle');
  }
  useItem(item: number) {
    switch (item) {
      case 1:
      case 2:
        this.rush(450, 1600, 0.28, 0.18);
        this.note(item === 2 ? 740 : 220, 110, 0.22, 0.07);
        break;
      case 3:
        this.rush(700, 160, 0.3, 0.14);
        this.note(170, 55, 0.3, 0.09);
        break;
      case 4:
        this.rush(350, 1900, 0.5, 0.23);
        this.note(120, 340, 0.28, 0.055);
        break;
      case 5:
        this.rush(220, 1400, 0.65, 0.26);
        this.note(95, 220, 0.4, 0.065);
        break;
      case 6:
        this.rush(950, 180, 0.55, 0.22);
        this.note(260, 65, 0.5, 0.08);
        break;
    }
  }
  private note(
    from: number,
    to: number,
    duration: number,
    volume: number,
    delay = 0,
    type: OscillatorType = 'sine',
  ) {
    if (this.effects.size >= 24) return;
    const t = this.context.currentTime + delay;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    this.effects.add(gain);
    source.type = type;
    source.frequency.setValueAtTime(from, t);
    source.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(gain).connect(this.destination);
    source.start(t);
    source.stop(t + duration);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.effects.delete(gain);
    };
  }
  private rush(from: number, to: number, duration: number, volume: number) {
    if (this.effects.size >= 24) return;
    const t = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    this.effects.add(gain);
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.destination);
    source.start(t);
    source.stop(t + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.effects.delete(gain);
    };
  }
  explosion(distance = 0) {
    if (distance >= 140 || this.effects.size >= 8) return;
    const context = this.context,
      t = context.currentTime;
    if (!this.explosionNoise) {
      this.explosionNoise = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * 0.65),
        context.sampleRate,
      );
      const samples = this.explosionNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const output = context.createGain();
    output.gain.value = Math.pow(1 - distance / 140, 2) * 0.65;
    output.connect(this.destination);
    this.effects.add(output);
    const noise = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      splash = context.createGain();
    noise.buffer = this.explosionNoise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.6);
    splash.gain.setValueAtTime(0.001, t);
    splash.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    splash.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    noise.connect(filter).connect(splash).connect(output);
    const boom = context.createOscillator(),
      envelope = context.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(135, t);
    boom.frequency.exponentialRampToValueAtTime(38, t + 0.4);
    envelope.gain.setValueAtTime(0.7, t);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    boom.connect(envelope).connect(output);
    noise.start(t);
    boom.start(t);
    boom.stop(t + 0.55);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      splash.disconnect();
      boom.disconnect();
      envelope.disconnect();
      output.disconnect();
      this.effects.delete(output);
    };
  }
  countdownCue(go = false) {
    if (!go) {
      this.tone(520, 0.16);
      return;
    }
    const t = this.context.currentTime;
    for (const [index, frequency] of [660, 880, 1320].entries()) {
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015 + index * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      oscillator.connect(gain).connect(this.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.7);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  }
  tone(frequency: number, duration = 0.14) {
    this.note(frequency, frequency, duration, 0.1);
  }
}
