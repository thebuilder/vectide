import { MusicSpectrum } from './spectrum';
const TITLE_SONG = { name: 'Before the First Credit', url: '/music/before-the-first-credit.mp3' };
export const SONGS = [
  { name: 'Apex Run', url: '/music/apex-run.mp3' },
  { name: 'Crimson Slipstream', url: '/music/crimson-slipstream.mp3' },
  { name: 'Neon Slipway', url: '/music/apex-runner.mp3' },
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
  song = 0;
  private titleScreen = true;
  error = '';
  constructor() {
    this.music.preload = 'none';
    this.music.volume = 0.65;
    this.music.src = TITLE_SONG.url;
    this.music.loop = true;
    this.music.addEventListener('ended', () => {
      if (!this.titleScreen) this.select((this.song + 1) % SONGS.length);
    });
    this.music.addEventListener('error', () => {
      this.error = 'Music unavailable';
    });
  }
  select(index: number) {
    this.song = index;
    if (this.titleScreen) return;
    this.music.src = SONGS[index].url;
    this.error = '';
    if (this.enabled && !this.suspended) void this.play();
  }
  setTitleScreen(titleScreen: boolean) {
    if (this.titleScreen === titleScreen) return;
    this.titleScreen = titleScreen;
    this.music.loop = titleScreen;
    this.music.src = titleScreen ? TITLE_SONG.url : SONGS[this.song].url;
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
  }
  get status() {
    return {
      song: this.titleScreen ? TITLE_SONG.name : SONGS[this.song].name,
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
      this.filter.frequency.value = 250;
      this.gain.gain.value = 0;
      this.oscillator.connect(this.filter).connect(this.gain).connect(this.context.destination);
      this.oscillator.start();
    }
    this.enabled = true;
    this.suspended = false;
    await this.play();
  }
  update(speed: number, throttle: number, active: boolean) {
    if (!this.context || !this.oscillator || !this.gain) return;
    const t = this.context.currentTime;
    this.oscillator.frequency.setTargetAtTime(42 + speed * 4 + throttle * 20, t, 0.08);
    this.gain.gain.setTargetAtTime(this.enabled && active ? 0.025 : 0, t, 0.1);
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
      gain.gain.linearRampToValueAtTime(0.065, t + 0.015 + index * 0.025);
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
    g.gain.setValueAtTime(0.075, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.context.destination);
    o.start();
    o.stop(t + duration);
  }
}
