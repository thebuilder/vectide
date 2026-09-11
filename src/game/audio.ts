import { MusicSpectrum } from './spectrum';
const TITLE_SONG = { name: 'Before the First Credit', url: '/music/before-the-first-credit.mp3' };
const FREE_RIDE_SONG = { name: 'Horizon Lane', url: '/music/horizon-lane.mp3' };
const COURSE_SONGS = [
  { name: 'Sapphire Wake', url: '/music/sapphire-wake.mp3' },
  { name: 'Neon Slipway', url: '/music/apex-runner.mp3' },
  { name: 'Chrome Horizon', url: '/music/chrome-horizon.mp3' },
];
export class RaceAudio {
  private context?: AudioContext;
  private oscillator?: OscillatorNode;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
  enabled = false;
  readonly spectrum = new MusicSpectrum();
  readonly music = new Audio();
  private analyser?: AnalyserNode;
  private bins = new Uint8Array(1024);
  private suspended = false;
  private starting?: Promise<void>;
  private explosionNoise?: AudioBuffer;
  private effects = new Set<GainNode>();
  private song = 0;
  private scene: 'title' | 'freeride' | 'race' = 'title';
  error = '';
  constructor() {
    this.music.preload = 'none';
    this.music.volume = 0.32;
    this.music.src = TITLE_SONG.url;
    this.music.loop = true;
    this.music.addEventListener('error', () => {
      this.error = 'Music unavailable';
    });
  }
  selectCourse(index: number) {
    if (this.song === index) return;
    this.song = index;
    if (this.scene !== 'race') return;
    this.music.src = COURSE_SONGS[index].url;
    this.error = '';
    if (this.enabled && !this.suspended) void this.play();
  }
  private get currentSong() {
    return this.scene === 'title'
      ? TITLE_SONG
      : this.scene === 'freeride'
        ? FREE_RIDE_SONG
        : COURSE_SONGS[this.song];
  }
  setScene(scene: 'title' | 'freeride' | 'race') {
    if (this.scene === scene) return;
    this.scene = scene;
    this.music.loop = true;
    this.music.src = this.currentSong.url;
    this.error = '';
    if (this.enabled && !this.suspended) void this.play();
  }
  private async play() {
    try {
      await this.music.play();
      this.error = '';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.error = 'Tap SOUND to retry';
    }
  }
  mute() {
    this.enabled = false;
    this.music.pause();
    if (this.context)
      for (const gain of this.effects) gain.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
  }
  get status() {
    return {
      song: this.currentSong.name,
      enabled: this.enabled,
      playing: !this.music.paused,
      time: this.music.currentTime,
      error: this.error,
      bands: { ...this.spectrum.bands },
    };
  }
  transport(paused: boolean, dt: number) {
    if (paused !== this.suspended) {
      this.suspended = paused;
      if (paused) this.music.pause();
      else if (this.enabled) void this.play();
    }
    this.analyser?.getByteFrequencyData(this.bins);
    this.spectrum.update(
      this.bins,
      (this.context?.sampleRate ?? 48000) / 2048,
      dt,
      this.enabled && !this.music.paused,
    );
  }
  dispose() {
    this.music.pause();
    this.music.removeAttribute('src');
    this.music.load();
    void this.context?.close();
  }

  async start() {
    if (this.starting) return this.starting;
    this.starting = this.initialize();
    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }
  private async initialize() {
    this.context ??= new AudioContext();
    await this.context.resume();
    if (!this.analyser) {
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.35;
      this.context
        .createMediaElementSource(this.music)
        .connect(this.analyser)
        .connect(this.context.destination);
    }
    if (!this.oscillator) {
      this.oscillator = this.context.createOscillator();
      this.oscillator.type = 'sawtooth';
      this.gain = this.context.createGain();
      this.filter = this.context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1100;
      this.gain.gain.value = 0;
      this.oscillator.connect(this.filter).connect(this.gain).connect(this.context.destination);
      this.oscillator.start();
    }
    this.enabled = true;
    this.suspended = false;
    await this.play();
  }
  update(speed: number, throttle: number, active: boolean, contact = 1) {
    if (!this.context || !this.oscillator || !this.gain) return;
    const t = this.context.currentTime;
    this.oscillator.frequency.setTargetAtTime(
      42 + speed * 4 + throttle * (20 + (1 - contact) * 35),
      t,
      0.08,
    );
    this.gain.gain.setTargetAtTime(this.enabled && active ? 0.12 + contact * 0.035 : 0, t, 0.1);
  }
  explosion(distance = 0) {
    if (!this.enabled || !this.context || distance >= 140 || this.effects.size >= 8) return;
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
    output.connect(context.destination);
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
    if (!this.enabled || !this.context) return;
    const t = this.context.currentTime;
    for (const [index, frequency] of [660, 880, 1320].entries()) {
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015 + index * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.7);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  }
  tone(frequency: number, duration = 0.14) {
    if (!this.enabled || !this.context) return;
    const o = this.context.createOscillator(),
      g = this.context.createGain(),
      t = this.context.currentTime;
    o.type = 'sine';
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.context.destination);
    o.start();
    o.stop(t + duration);
  }
}
