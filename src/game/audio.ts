import { EngineAudio } from './engine-audio';
import { SoundEffects } from './sound-effects';
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
  private engine?: EngineAudio;
  private effects?: SoundEffects;
  private soundsGain?: GainNode;
  private musicGain?: GainNode;
  private levels = { sounds: 1, music: 0.6 };
  enabled = false;
  readonly spectrum = new MusicSpectrum();
  readonly music = new Audio();
  private analyser?: AnalyserNode;
  private bins = new Uint8Array(1024);
  private signal = new Uint8Array(2048);
  private suspended = false;
  private starting?: Promise<void>;
  private song = 0;
  private scene: 'title' | 'freeride' | 'race' = 'title';
  error = '';
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem('vectide:volume') ?? '{}');
      for (const channel of ['sounds', 'music'] as const) {
        if (typeof saved?.[channel] === 'number' && Number.isFinite(saved[channel]))
          this.levels[channel] = Math.max(0, Math.min(1, saved[channel]));
      }
    } catch {
      // Volume controls remain available when storage is unavailable.
    }
    this.music.preload = 'none';
    this.music.src = TITLE_SONG.url;
    this.music.loop = true;
    this.music.addEventListener('error', () => {
      this.error = 'Music unavailable';
    });
  }
  get volumes() {
    return { ...this.levels };
  }
  setVolume(channel: 'sounds' | 'music', value: number) {
    if (!Number.isFinite(value)) return;
    this.levels[channel] = Math.max(0, Math.min(1, value));
    this.syncVolumes();
    try {
      localStorage.setItem('vectide:volume', JSON.stringify(this.levels));
    } catch {
      // Keep the selected levels for this visit if they cannot be saved.
    }
  }
  private syncVolumes() {
    if (!this.context) return;
    const active = this.enabled && !this.suspended;
    // A curved slider gives useful quiet levels instead of scaling amplitude linearly.
    this.soundsGain?.gain.setTargetAtTime(
      active ? this.levels.sounds ** 2 : 0,
      this.context.currentTime,
      0.01,
    );
    // Reserve mix headroom for foreground cues instead of matching a mastered track at full gain.
    this.musicGain?.gain.setTargetAtTime(
      active ? this.levels.music ** 2 * 0.5 : 0,
      this.context.currentTime,
      0.01,
    );
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
    this.syncVolumes();
  }
  get status() {
    return {
      song: this.currentSong.name,
      enabled: this.enabled,
      playing: !this.music.paused,
      time: this.music.currentTime,
      error: this.error,
      bands: { ...this.spectrum.bands },
      beat: this.spectrum.beat,
      beatStrength: this.spectrum.beatStrength,
      volumes: this.volumes,
    };
  }
  transport(paused: boolean, dt: number) {
    if (paused !== this.suspended) {
      this.suspended = paused;
      this.syncVolumes();
      if (paused) this.music.pause();
      else if (this.enabled) void this.play();
    }
    this.analyser?.getByteFrequencyData(this.bins);
    this.analyser?.getByteTimeDomainData(this.signal);
    this.spectrum.update(
      this.bins,
      (this.context?.sampleRate ?? 48000) / 2048,
      dt,
      this.enabled && !this.music.paused && this.levels.music > 0,
      this.signal,
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
    if (!this.soundsGain) {
      this.soundsGain = this.context.createGain();
      this.soundsGain.gain.value = 0;
      this.soundsGain.connect(this.context.destination);
    }
    if (!this.analyser) {
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0;
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.35;
      this.context
        .createMediaElementSource(this.music)
        .connect(this.musicGain)
        .connect(this.analyser)
        .connect(this.context.destination);
    }
    if (!this.engine) {
      this.effects = new SoundEffects(this.context, this.soundsGain);
      this.engine = new EngineAudio(this.context, this.soundsGain, this.effects.noise);
    }
    this.enabled = true;
    this.suspended = false;
    this.syncVolumes();
    await this.play();
  }
  update(speed: number, throttle: number, active: boolean, contact = 1, boost = 0) {
    this.engine?.update(speed, throttle, this.enabled && !this.suspended && active, contact, boost);
  }
  explosion(distance = 0) {
    if (this.enabled && !this.suspended) this.effects?.explosion(distance);
  }
  countdownCue(go = false) {
    if (this.enabled && !this.suspended) this.effects?.countdownCue(go);
  }
  finish() {
    if (this.enabled && !this.suspended) this.effects?.finish();
  }
  tone(frequency: number, duration = 0.14) {
    if (this.enabled && !this.suspended) this.effects?.tone(frequency, duration);
  }
  pickup() {
    if (this.enabled && !this.suspended) this.effects?.pickup();
  }
  useItem(item: number) {
    if (this.enabled && !this.suspended) this.effects?.useItem(item);
  }
}
