import * as T from 'three';
import { ScanIntro } from './intro';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TRACKS, type Track } from './tracks';
import {
  aiInput,
  catchupPower,
  clamp,
  collideRacers,
  createRacer,
  raceProgress,
  recoverRacer,
  stepRacer,
  updateProgress,
  type Difficulty,
  type Input,
  type Racer,
} from './physics';
import { createWorld, type World } from './visuals';
import { VoxelSpray } from './spray';
import { createJet, animateJet, inspectJet } from './jets';
import { dark } from './geometry';
import { waterHeight } from './water';
import { RaceAudio } from './audio';
export type Mode = 'race' | 'trial';
export type State = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished';
export interface Snapshot {
  state: State;
  track: Track;
  mode: Mode;
  time: number;
  countdown: number;
  player: Racer;
  racers: Racer[];
  position: number;
  speed: number;
  missed: boolean;
  fps: number;
}
export class Engine {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(62, 1, 0.1, 6000);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private world: World;
  private jets: T.Group[] = [];
  private spray = new VoxelSpray();
  private cameraAnchor = new T.Vector3();
  readonly audio = new RaceAudio();
  track = TRACKS[0];
  mode: Mode = 'race';
  difficulty: Difficulty = 'normal';
  state: State = 'menu';
  racers: Racer[] = [];
  time = 0;
  private visualTime = 0;
  private countdown = 3;
  private accumulator = 0;
  private previous = 0;
  private hudElapsed = 0;
  private frames = 0;
  private fps = 60;
  private fpsElapsed = 0;
  private keys = new Set<string>();
  private resumeState: State = 'racing';
  private camTarget = new T.Vector3();
  private frameId = 0;
  private intro?: ScanIntro;
  private introReduced = matchMedia('(prefers-reduced-motion: reduce)');
  replayIntro() {
    this.intro?.finish();
    this.world.gates.forEach((g) => {
      g.visible = this.state !== 'menu';
    });
    this.jets.forEach((jet, i) => {
      const r = this.racers[i];
      jet.visible = this.state !== 'menu' || i === 0;
      jet.position.set(r.x, r.y, r.z);
      jet.rotation.set(0, r.yaw, 0);
      jet.rotateX(-r.pitch);
      jet.rotateZ(r.roll);
      animateJet(jet, r, 0);
    });
    this.intro = new ScanIntro(this.scene, this.introReduced.matches, this.world, this.jets);
  }
  get sprayCount() {
    return this.spray.activeCount;
  }
  get introStatus() {
    return {
      active: this.intro?.active ?? false,
      cages: this.intro?.cageCount ?? 0,
      progress: this.intro?.active ? this.intro.progress : 1,
    };
  }
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  onFrame: (now: number) => void = () => {};
  onUpdate: (s: Snapshot) => void = () => {};
  onFinish: (s: Snapshot) => void = () => {};
  onPause: () => void = () => {};
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.info.autoReset = false;
    this.scene.add(new T.HemisphereLight(0xc9faff, 0x382847, 2.3));
    const sun = new T.DirectionalLight(0xffbea6, 2.6);
    sun.position.set(-200, 300, -500);
    this.scene.add(sun);
    this.world = createWorld(this.track);
    this.scene.add(this.world.group, this.spray.object);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.48, 0.5, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resetRacers();
    this.replayIntro();
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.frameId = requestAnimationFrame(this.frame);
  }
  private resize = () => {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  private keyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) &&
      this.state !== 'menu'
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (
      e.code === 'Escape' &&
      (this.state === 'racing' || this.state === 'countdown' || this.state === 'paused')
    ) {
      e.preventDefault();
      this.pause();
    }
    if (e.code === 'KeyR') this.reset();
  };
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private blur = () => {
    this.keys.clear();
    if (this.state === 'racing' || this.state === 'countdown') this.pause();
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  private resetRacers() {
    this.spray.clear();
    this.jets.forEach((j) => {
      this.scene.remove(j);
      const materials = new Set<T.Material>();
      j.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.LineSegments) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            if (m !== dark) materials.add(m);
            if (m instanceof T.MeshStandardMaterial) m.map?.dispose();
          });
        }
      });
      materials.forEach((m) => m.dispose());
    });
    this.racers = Array.from({ length: this.mode === 'race' ? 6 : 1 }, (_, i) =>
      createRacer(this.track, i),
    );
    this.jets = this.racers.map((r) => {
      const jet = createJet(r.color, r.id + 1);
      this.scene.add(jet);
      return jet;
    });
    const p = this.racers[0];
    this.camera.position.set(p.x - Math.sin(p.yaw) * 17, p.y + 8, p.z - Math.cos(p.yaw) * 17);
    this.camTarget.set(p.x, p.y + 1, p.z);
    this.cameraAnchor.set(p.x, p.y, p.z);
  }
  selectTrack(index: number) {
    this.intro?.finish();
    this.scene.remove(this.world.group);
    this.world.dispose();
    this.track = TRACKS[index];
    this.world = createWorld(this.track);
    this.scene.add(this.world.group);
    this.time = 0;
    this.visualTime = 0;
    this.resetRacers();
  }
  start(mode: Mode) {
    this.intro?.finish();
    this.audio.setTitleScreen(false);
    this.mode = mode;
    this.time = 0;
    this.visualTime = 0;
    this.accumulator = 0;
    this.countdown = 3;
    this.resetRacers();
    this.keys.clear();
    this.state = 'countdown';
    this.audio.countdownCue();
    this.onUpdate(this.snapshot());
  }
  pause() {
    if (this.state === 'paused') {
      this.state = this.resumeState;
      this.keys.clear();
    } else {
      this.resumeState = this.state;
      this.state = 'paused';
      this.keys.clear();
    }
    this.onPause();
    this.onUpdate(this.snapshot());
  }
  menu() {
    this.spray.clear();
    this.audio.setTitleScreen(true);
    this.state = 'menu';
    this.keys.clear();
    this.onUpdate(this.snapshot());
  }
  reset() {
    if (this.state !== 'racing') return;
    recoverRacer(this.racers[0], this.track, this.visualTime);
    this.audio.tone(180);
  }
  private input(): Input {
    const key = (...codes: string[]) => (codes.some((c) => this.keys.has(c)) ? 1 : 0);
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    const axis = pad?.axes[0] ?? 0;
    return {
      throttle: Math.max(key('KeyW', 'ArrowUp'), pad?.buttons[7]?.value ?? 0),
      steer: clamp(
        key('KeyA', 'ArrowLeft') - key('KeyD', 'ArrowRight') - (Math.abs(axis) > 0.12 ? axis : 0),
        -1,
        1,
      ),
      brake: Math.max(key('KeyS', 'ArrowDown', 'Space'), pad?.buttons[6]?.value ?? 0),
      lean: key('ShiftLeft', 'ShiftRight') - (pad?.axes[1] ?? 0) * 0.5,
    };
  }
  get riderPose() {
    return inspectJet(this.jets[0]);
  }
  snapshot(): Snapshot {
    const p = this.racers[0],
      g = this.track.gates[p.nextGate];
    return {
      state: this.state,
      track: this.track,
      mode: this.mode,
      time: this.time,
      countdown: this.countdown,
      player: p,
      racers: this.racers,
      position:
        1 +
        this.racers.filter(
          (r) =>
            r !== p &&
            (r.finished
              ? !p.finished || r.finishTime < p.finishTime
              : !p.finished && raceProgress(r, this.track) > raceProgress(p, this.track)),
        ).length,
      speed: Math.hypot(p.vx, p.vz) * 3.6,
      missed: (p.x - g.x) * g.tx + (p.z - g.z) * g.tz > 12,
      fps: this.fps,
    };
  }
  private tick(dt: number) {
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== before) this.audio.countdownCue(this.countdown <= 0);
      if (this.countdown <= 0) this.state = 'racing';
      return;
    }
    if (this.state !== 'racing') return;
    this.time += dt;
    this.visualTime += dt;
    const input = this.input();
    for (const r of this.racers) {
      const before = { x: r.x, z: r.z };
      const control = r.finished
        ? { throttle: 0, steer: 0, brake: 0.3, lean: 0 }
        : r.id === 0
          ? input
          : aiInput(r, this.track, this.racers, this.difficulty);
      stepRacer(
        r,
        control,
        this.track,
        this.visualTime,
        dt,
        r.id === 0 ? 1 : catchupPower(r, this.racers[0], this.track),
      );
      if (
        updateProgress(r, before, this.track, this.time, this.mode === 'race' ? 3 : 1) &&
        r.id === 0
      )
        this.audio.tone(r.nextGate === 1 ? 880 : 660, 0.08);
      if (r.id > 0 && !r.finished && this.time - r.lastProgress > 18) {
        recoverRacer(r, this.track, this.visualTime);
        r.lastProgress = this.time;
      }
    }
    for (let a = 0; a < this.racers.length; a++)
      for (let b = a + 1; b < this.racers.length; b++)
        collideRacers(this.racers[a], this.racers[b]);
    if (this.racers[0].finished) {
      this.state = 'finished';
      this.onFinish(this.snapshot());
    }
  }
  private frame = (now: number) => {
    this.onFrame(now);
    const dt = Math.min((now - (this.previous || now)) / 1000, 0.1);
    this.previous = now;
    this.fpsElapsed += dt;
    this.frames++;
    if (this.fpsElapsed > 1) {
      this.fps = this.frames / this.fpsElapsed;
      this.frames = 0;
      this.fpsElapsed = 0;
    }
    if (this.state === 'menu' || this.state === 'countdown') {
      const steps = Math.max(1, Math.ceil(dt * 120));
      for (let i = 0; i < steps; i++) {
        this.visualTime += dt / steps;
        for (const r of this.racers) {
          const grid = { x: r.x, z: r.z, yaw: r.yaw };
          stepRacer(
            r,
            { throttle: 0, steer: 0, brake: 1, lean: 0 },
            this.track,
            this.visualTime,
            dt / steps,
          );
          Object.assign(r, grid, { vx: 0, vz: 0 });
        }
      }
    }
    if (this.state === 'racing' || this.state === 'countdown') {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.tick(1 / 120);
        this.accumulator -= 1 / 120;
      }
    }
    const p = this.racers[0];
    this.audio.transport(this.state === 'paused', dt);
    const bands = this.reducedMotion.matches
      ? { low: 0, mid: 0, high: 0 }
      : this.audio.spectrum.bands;
    this.world.update(this.visualTime, p, bands);
    this.bloom.strength = 0.48 + bands.low * 0.1;
    this.world.gates.forEach((g, i) => {
      const next = p.nextGate,
        count = this.track.gates.length;
      g.visible =
        this.state !== 'menu' &&
        (i === next || i === (next + 1) % count || (i === 0 && next >= count - 2));
    });
    this.racers.forEach((r, i) => {
      const jet = this.jets[i];
      jet.visible = this.state !== 'menu' || i === 0;
      jet.position.set(r.x, r.y, r.z);
      jet.rotation.set(0, r.yaw, 0);
      jet.rotateX(-r.pitch);
      jet.rotateZ(r.roll);
      animateJet(jet, r, this.state === 'paused' || this.state === 'finished' ? 0 : dt);
    });
    if (this.state === 'menu') {
      const a = p.yaw + 1.15 + Math.sin(this.visualTime * 0.1) * 0.12;
      const desired = new T.Vector3(p.x - Math.sin(a) * 12, p.y + 4, p.z - Math.cos(a) * 12);
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 2));
      this.camTarget.set(p.x, p.y + 1, p.z);
    } else {
      const speed = Math.hypot(p.vx, p.vz),
        desired = new T.Vector3(
          p.x - Math.sin(p.yaw) * 7.2,
          p.y + 2.9,
          p.z - Math.cos(p.yaw) * 7.2,
        );
      this.camera.position.x += p.x - this.cameraAnchor.x;
      this.camera.position.z += p.z - this.cameraAnchor.z;
      this.camTarget.x += p.x - this.cameraAnchor.x;
      this.camTarget.z += p.z - this.cameraAnchor.z;
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
      this.camera.position.y = Math.max(
        this.camera.position.y,
        waterHeight(
          this.camera.position.x,
          this.camera.position.z,
          this.visualTime,
          this.track.wave,
        ) + 0.8,
      );
      this.camTarget.lerp(
        new T.Vector3(p.x + Math.sin(p.yaw) * 4, p.y + 0.6, p.z + Math.cos(p.yaw) * 4),
        1 - Math.exp(-dt * 9),
      );
      this.camera.fov +=
        (58 + Math.min(speed / 32, 1) * 5 - this.camera.fov) * (1 - Math.exp(-dt * 2));
      this.camera.updateProjectionMatrix();
    }
    this.cameraAnchor.set(p.x, p.y, p.z);
    this.camera.lookAt(this.camTarget);
    if (this.state === 'racing') this.spray.update(dt, this.racers, this.track, this.visualTime);
    const control = this.input();
    this.audio.update(Math.hypot(p.vx, p.vz), control.throttle, this.state === 'racing');
    this.intro?.update(dt);
    this.renderer.info.reset();
    this.composer.render();
    this.hudElapsed += dt;
    if (this.hudElapsed > 0.08) {
      this.hudElapsed = 0;
      this.onUpdate(this.snapshot());
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
  dispose() {
    cancelAnimationFrame(this.frameId);
    this.intro?.finish();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.world.dispose();
    this.audio.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
