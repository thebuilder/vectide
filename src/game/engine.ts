import { PickupVisuals } from './pickup-visuals';
import { Pickups } from './pickups';
import { NetworkRace } from '../multiplayer/race';
import { createLobbyRacers, lobbyCamera } from '../multiplayer/lobby';
import { NEUTRAL, type Member } from '../multiplayer/protocol';
import { cancelTrickSetup } from './aerial';
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
  crossesGate,
  racePosition,
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
export type State = 'menu' | 'lobby' | 'freeride' | 'countdown' | 'racing' | 'paused' | 'finished';
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
  private pickupVisuals = new PickupVisuals();
  private cameraAnchor = new T.Vector3();
  readonly audio = new RaceAudio();
  track = TRACKS[0];
  mode: Mode = 'race';
  difficulty: Difficulty = 'normal';
  pickupsEnabled = true;
  items = new Pickups(this.track, false);
  state: State = 'menu';
  racers: Racer[] = [];
  time = 0;
  private visualTime = 0;
  private countdown = 3;
  network?: NetworkRace;
  onlineMenuOpen = false;
  private lobby?: { members: Member[]; slot: number };
  get player() {
    return (
      this.network?.player ??
      (this.lobby ? this.racers.find((r) => r.id === this.lobby!.slot)! : this.racers[0])
    );
  }
  private accumulator = 0;
  private previous = 0;
  private hudElapsed = 0;
  private frames = 0;
  private fps = 60;
  private fpsElapsed = 0;
  private keys = new Set<string>();
  private itemRequested = false;
  private resumeState: State = 'racing';
  private camTarget = new T.Vector3();
  private frameId = 0;
  private intro?: ScanIntro;
  private introReduced = matchMedia('(prefers-reduced-motion: reduce)');
  replayIntro() {
    this.intro?.finish();
    this.world.ramps.visible = this.state !== 'menu';
    this.world.gates.forEach((g) => {
      g.visible = this.state !== 'menu';
    });
    this.jets.forEach((jet, i) => {
      const r = this.racers[i];
      jet.visible = !this.network?.disconnected.has(r.id) && (this.state !== 'menu' || i === 0);
      jet.position.set(r.x, r.y, r.z);
      jet.rotation.set(0, r.yaw + r.air.yaw, 0);
      jet.rotateX(-r.pitch - r.air.pitch);
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
  onRender: () => void = () => {};
  onUpdate: (s: Snapshot) => void = () => {};
  onFinish: (s: Snapshot) => void = () => {};
  onPause: () => void = () => {};
  onLeavePractice: () => void = () => {};
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
    this.scene.add(new T.HemisphereLight(0xb5cce5, 0x237b78, 1.25));
    const sun = new T.DirectionalLight(0xffad86, 2.8);
    sun.position.set(2300, 360, 500);
    this.scene.add(sun);
    // Cool sky fill balances the low, warm sunset and gives dark suit facets definition.
    const fill = new T.DirectionalLight(0x82c8e6, 0.9);
    fill.position.set(-500, 250, -350);
    this.scene.add(fill);
    this.world = createWorld(this.track);
    this.scene.add(this.world.group, this.spray.object, this.pickupVisuals.group);
    this.pickupVisuals.onSplash = (x, y, z, strength) => this.spray.burst(x, y, z, strength);
    this.pickupVisuals.onExplosion = (x, y, z) => {
      this.spray.burst(x, y, z);
      if (this.state !== 'paused')
        this.audio.explosion(Math.hypot(this.player.x - x, this.player.z - z));
    };
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.28, 0.25, 1.1);
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
    this.frameLobby();
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
      (this.state === 'racing' ||
        this.state === 'freeride' ||
        this.state === 'countdown' ||
        this.state === 'paused')
    ) {
      e.preventDefault();
      this.pause();
    }
    if (e.code === 'KeyR') this.reset();
    if (e.code === 'KeyQ') this.useItem();
  };
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private blur = () => {
    this.keys.clear();
    this.itemRequested = false;
    cancelTrickSetup(this.player);
    Object.assign(this.touchInput, {
      throttle: 0,
      brake: 0,
      steer: 0,
      lean: 0,
      trick: 0,
      use: false,
    });
    if (!this.network && (this.state === 'racing' || this.state === 'countdown')) this.pause();
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  private resetRacers(menu = this.state === 'menu') {
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
    this.racers =
      this.network?.racers ??
      (this.lobby
        ? createLobbyRacers(this.track, this.lobby.members)
        : Array.from({ length: this.mode === 'race' ? 6 : 1 }, (_, i) =>
            createRacer(this.track, i),
          ));
    this.jets = this.racers.map((r) => {
      const jet = createJet(r.color, r.id + 1);
      this.scene.add(jet);
      return jet;
    });
    const p = this.player;
    if (menu) {
      // Stage the title offshore so the coast stays on the horizon, clear of the rider.
      p.x = -320;
      p.z = -250;
      p.yaw = Math.PI / 4;
      p.y = waterHeight(p.x, p.z, this.visualTime, this.track) + 0.6;
      this.camera.position.set(p.x - Math.sin(1.72) * 12, p.y + 4, p.z - Math.cos(1.72) * 12);
    } else
      this.camera.position.set(p.x - Math.sin(p.yaw) * 17, p.y + 8, p.z - Math.cos(p.yaw) * 17);
    this.camTarget.set(p.x, p.y + 1, p.z);
    this.cameraAnchor.set(p.x, p.y, p.z);
  }
  selectTrack(index: number) {
    this.loadTrack(TRACKS[index]);
  }
  private loadTrack(track: Track) {
    this.intro?.finish();
    this.scene.remove(this.world.group);
    this.world.dispose();
    this.track = track;
    this.world = createWorld(this.track);
    this.scene.add(this.world.group);
    this.time = 0;
    this.visualTime = 0;
    this.resetRacers();
  }
  showLobby(practice: NetworkRace, members: Member[]) {
    this.intro?.finish();
    const state = practice.riding.has(practice.localSlot) ? 'freeride' : 'lobby';
    const changed = this.state !== state || this.network !== practice;
    const rebuild =
      this.network !== practice || JSON.stringify(this.lobby?.members) !== JSON.stringify(members);
    this.network = practice;
    this.lobby = { members: structuredClone(members), slot: practice.localSlot };
    this.state = state;
    if (this.track !== practice.track) this.loadTrack(practice.track);
    else if (rebuild) this.resetRacers();
    if (changed) {
      this.keys.clear();
      this.itemRequested = false;
      Object.assign(this.touchInput, {
        throttle: 0,
        brake: 0,
        steer: 0,
        lean: 0,
        trick: 0,
        use: false,
      });
      this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.cameraAnchor.set(this.player.x, this.player.y, this.player.z);
      this.audio.setScene(state === 'freeride' ? 'freeride' : 'title');
    }
    if (state === 'lobby') this.frameLobby();
    if (changed) this.onUpdate(this.snapshot());
  }
  private frameLobby() {
    if (!this.lobby || this.state !== 'lobby') return;
    this.camera.fov = 62;
    // Leave the lower part of a phone screen free for the room controls.
    if (innerWidth <= 700)
      this.camera.setViewOffset(
        innerWidth,
        innerHeight,
        0,
        innerHeight * 0.17,
        innerWidth,
        innerHeight,
      );
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const view = lobbyCamera(this.track, this.racers.length, this.camera.aspect);
    this.camera.position.set(view.position.x, view.position.y, view.position.z);
    this.camTarget.set(view.target.x, view.target.y, view.target.z);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
  }
  lobbyLabels() {
    if (!this.lobby) return [];
    return this.racers.map((r, index) => {
      // Labels follow the exact interpolated pose drawn this frame, not network snapshots.
      const point = this.jets[index].position.clone();
      point.y += 3.6;
      point.project(this.camera);
      return {
        id: r.id,
        x: (point.x + 1) * 50,
        y: (1 - point.y) * 50,
        visible:
          point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95,
      };
    });
  }
  startNetwork(race: NetworkRace) {
    this.lobby = undefined;
    this.network = undefined;
    const index = TRACKS.indexOf(race.track);
    if (this.track !== race.track) this.selectTrack(index);
    this.network = race;
    this.onlineMenuOpen = false;
    this.start('race');
  }
  start(mode: Mode) {
    this.camera.clearViewOffset();
    this.intro?.finish();
    this.audio.setScene('race');
    this.mode = mode;
    this.time = 0;
    this.visualTime = 0;
    this.accumulator = 0;
    this.countdown = 3;
    this.resetRacers(false);
    this.items =
      this.network?.items ?? new Pickups(this.track, this.pickupsEnabled && mode === 'race');
    this.keys.clear();
    this.itemRequested = false;
    cancelTrickSetup(this.player);
    Object.assign(this.touchInput, {
      throttle: 0,
      brake: 0,
      steer: 0,
      lean: 0,
      trick: 0,
      use: false,
    });
    this.state = 'countdown';
    this.audio.countdownCue();
    this.onUpdate(this.snapshot());
  }
  pause() {
    if (this.state === 'freeride') {
      this.onLeavePractice();
      return;
    }
    if (this.network) {
      this.onlineMenuOpen = !this.onlineMenuOpen;
      this.keys.clear();
      this.itemRequested = false;
      Object.assign(this.touchInput, {
        throttle: 0,
        brake: 0,
        steer: 0,
        lean: 0,
        trick: 0,
        use: false,
      });
      this.onPause();
      return;
    }
    if (this.state === 'paused') {
      this.state = this.resumeState;
      this.keys.clear();
      this.itemRequested = false;
      cancelTrickSetup(this.player);
      Object.assign(this.touchInput, {
        throttle: 0,
        brake: 0,
        steer: 0,
        lean: 0,
        trick: 0,
        use: false,
      });
    } else {
      this.resumeState = this.state;
      this.state = 'paused';
      this.keys.clear();
      this.itemRequested = false;
      cancelTrickSetup(this.player);
      Object.assign(this.touchInput, {
        throttle: 0,
        brake: 0,
        steer: 0,
        lean: 0,
        trick: 0,
        use: false,
      });
    }
    this.onPause();
    this.onUpdate(this.snapshot());
  }
  menu() {
    this.camera.clearViewOffset();
    this.spray.clear();
    this.audio.setScene('title');
    this.state = 'menu';
    this.items = new Pickups(this.track, false);
    if (this.network || this.lobby) {
      this.network = undefined;
      this.lobby = undefined;
      this.onlineMenuOpen = false;
    }
    this.resetRacers();
    this.keys.clear();
    this.itemRequested = false;
    cancelTrickSetup(this.player);
    Object.assign(this.touchInput, {
      throttle: 0,
      brake: 0,
      steer: 0,
      lean: 0,
      trick: 0,
      use: false,
    });
    this.onUpdate(this.snapshot());
  }
  useItem() {
    if (this.state === 'racing' && !this.onlineMenuOpen) this.itemRequested = true;
  }
  reset() {
    if (this.state !== 'racing' && this.state !== 'freeride') return;
    if (this.network) this.network.requestReset();
    else recoverRacer(this.player, this.track, this.visualTime);
    this.audio.tone(180);
  }
  readonly touchInput: Input = { throttle: 0, brake: 0, steer: 0, lean: 0 };
  private input(): Input {
    if (
      this.state === 'lobby' ||
      (this.network && (this.onlineMenuOpen || document.hidden || !document.hasFocus()))
    )
      return NEUTRAL;
    const touch = document.body.dataset.input === 'touch' ? this.touchInput : undefined;
    const autoThrottle =
      !!touch &&
      !touch.brake &&
      this.player.recovery.phase === 'riding' &&
      ['racing', 'freeride', 'countdown'].includes(this.state);
    const key = (...codes: string[]) => (codes.some((c) => this.keys.has(c)) ? 1 : 0);
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    const axis = pad?.axes[0] ?? 0;
    return {
      throttle: Math.max(Number(autoThrottle), key('KeyW', 'ArrowUp'), pad?.buttons[7]?.value ?? 0),
      steer: clamp(
        (touch?.steer ?? 0) +
          key('KeyA', 'ArrowLeft') -
          key('KeyD', 'ArrowRight') -
          (Math.abs(axis) > 0.12 ? axis : 0),
        -1,
        1,
      ),
      brake: Math.max(
        touch?.brake ?? 0,
        key('KeyS', 'ArrowDown', 'Space'),
        pad?.buttons[6]?.value ?? 0,
      ),
      lean: clamp(
        (touch?.lean ?? 0) + key('ShiftLeft', 'ShiftRight') - key('KeyC') + (pad?.axes[1] ?? 0),
        -1,
        1,
      ),
      use: this.itemRequested || !!touch?.use || !!key('KeyQ') || !!pad?.buttons[4]?.pressed,
      trick:
        touch?.trick ||
        (key('KeyE') || pad?.buttons[5]?.pressed
          ? Math.abs(axis) > 0.3
            ? -Math.sign(axis) * 2
            : key('KeyA', 'ArrowLeft')
              ? 2
              : key('KeyD', 'ArrowRight')
                ? -2
                : 1
          : 0),
    };
  }
  get riderPose() {
    return inspectJet(this.jets[this.racers.indexOf(this.player)]);
  }
  snapshot(): Snapshot {
    const p = this.player,
      g = this.track.gates[p.nextGate];
    return {
      state: this.state,
      track: this.track,
      mode: this.mode,
      time: p.finished ? p.finishTime : this.time,
      countdown: this.countdown,
      player: p,
      racers: this.racers,
      position: racePosition(
        p,
        this.racers.filter((r) => !this.network?.disconnected.has(r.id) || r.finished),
        this.track,
      ),
      speed: Math.hypot(p.vx, p.vz) * 3.6,
      missed: !this.track.practiceRadius && (p.x - g.x) * g.tx + (p.z - g.z) * g.tz > 12,
      fps: this.fps,
    };
  }
  private tick(dt: number) {
    if (this.network) {
      const before = Math.ceil(this.countdown);
      this.network.step(this.input());
      this.itemRequested = false;
      this.time = this.network.time;
      this.visualTime = this.network.tick / 120;
      this.countdown = this.network.countdown;
      if (this.track.practiceRadius) return;
      if (this.network.running && Math.ceil(this.countdown) !== before)
        this.audio.countdownCue(this.countdown <= 0);
      if (this.player.finished && this.state !== 'finished') {
        this.state = 'finished';
        this.onFinish(this.snapshot());
      } else if (!this.player.finished)
        this.state = this.countdown > 0 || !this.network.running ? 'countdown' : 'racing';
      return;
    }
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== before) this.audio.countdownCue(this.countdown <= 0);
      if (this.countdown <= 0) this.state = 'racing';
      return;
    }
    if (this.state !== 'racing' && this.state !== 'finished') return;
    this.time += dt;
    this.visualTime += dt;
    const input = this.input();
    this.itemRequested = false;
    for (const r of this.racers) {
      const before = { x: r.x, z: r.z };
      const control =
        r.id === 0 && !r.finished ? input : aiInput(r, this.track, this.racers, this.difficulty);
      this.items.use(
        r,
        r.id === 0 ? !!control.use : this.time % 3 < dt && Math.hypot(r.vx, r.vz) > 5,
      );
      stepRacer(
        r,
        control,
        this.track,
        this.visualTime,
        dt,
        r.id === 0 ? 1 : catchupPower(r, this.player, this.track),
        this.items.surface,
      );
      // Continue steering through gates after finishing without changing recorded results.
      if (r.finished && crossesGate(before, r, this.track.gates[r.nextGate])) {
        r.nextGate = (r.nextGate + 1) % this.track.gates.length;
        r.approachingGate = false;
      }
      if (
        updateProgress(r, before, this.track, this.time, this.mode === 'race' ? 3 : 1) &&
        r.id === 0
      )
        this.audio.tone(r.nextGate === 1 ? 880 : 660, 0.08);
      if (
        r.id > 0 &&
        !r.finished &&
        r.recovery.phase === 'riding' &&
        this.time - r.lastProgress > 18
      ) {
        recoverRacer(r, this.track, this.visualTime);
        r.lastProgress = this.time;
      }
    }
    for (let a = 0; a < this.racers.length; a++)
      for (let b = a + 1; b < this.racers.length; b++)
        collideRacers(this.racers[a], this.racers[b]);
    this.items.step(dt, this.visualTime, this.racers);
    if (this.state === 'racing' && this.player.finished) {
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
    if (
      !this.network &&
      (this.state === 'menu' || this.state === 'lobby' || this.state === 'countdown')
    ) {
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
    if (
      (this.network && this.lobby) ||
      this.state === 'racing' ||
      this.state === 'countdown' ||
      this.state === 'finished'
    ) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.tick(1 / 120);
        this.accumulator -= 1 / 120;
      }
    }
    const rendered = this.racers.map((r) => this.network?.renderRacer(r, dt) ?? r);
    const p = rendered[this.racers.indexOf(this.player)];
    this.audio.transport(this.state === 'paused', dt);
    const bands = this.reducedMotion.matches
      ? { low: 0, mid: 0, high: 0 }
      : this.audio.spectrum.bands;
    const itemSurface = (this.network?.items ?? this.items).surface;
    this.world.update(this.visualTime, p, bands, itemSurface);
    this.pickupVisuals.update(
      this.network?.items ?? this.items,
      this.visualTime,
      !this.track.practiceRadius &&
        ['countdown', 'racing', 'paused', 'finished'].includes(this.state),
      bands.low,
    );
    this.bloom.strength = 0.28 + bands.low * 0.05;
    this.world.ramps.visible = this.state !== 'menu';
    this.world.gates.forEach((g, i) => {
      const next = p.nextGate,
        count = this.track.gates.length;
      g.visible =
        !this.track.practiceRadius &&
        this.state !== 'menu' &&
        this.state !== 'lobby' &&
        (i === next || i === (next + 1) % count || (i === 0 && next >= count - 2));
    });
    rendered.forEach((r, i) => {
      const jet = this.jets[i];
      jet.visible = !this.network?.disconnected.has(r.id) && (this.state !== 'menu' || i === 0);
      jet.position.set(r.x, r.y, r.z);
      jet.rotation.set(0, r.yaw + r.air.yaw, 0);
      jet.rotateX(-r.pitch - r.air.pitch);
      jet.rotateZ(r.roll);
      animateJet(jet, r, this.state === 'paused' || this.state === 'finished' ? 0 : dt);
    });
    if (this.state === 'menu') {
      // Look across the islands toward the sunset instead of the empty outer sea.
      const portrait = this.camera.aspect < 1;
      const a =
        (portrait ? 1.4 : 1.72) +
        (this.reducedMotion.matches ? 0 : Math.sin(this.visualTime * 0.1) * 0.06);
      // Leave the menu's left column clear. Portrait looks farther ahead from above,
      // placing the rider in the open water below the buttons while retaining the sunset.
      const offset = portrait ? 2.6 : this.camera.aspect * 3.2;
      const x = p.x + Math.cos(a) * offset,
        z = p.z - Math.sin(a) * offset,
        distance = portrait ? 22 : 12,
        lead = portrait ? 36 : 0;
      const desired = new T.Vector3(
        x - Math.sin(a) * distance,
        p.y + (portrait ? 16 : 4),
        z - Math.cos(a) * distance,
      );
      this.camera.position.lerp(desired, this.reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 2));
      this.camTarget.set(x + Math.sin(a) * lead, p.y + 1, z + Math.cos(a) * lead);
    } else if (this.state !== 'lobby') {
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
        waterHeight(this.camera.position.x, this.camera.position.z, this.visualTime, itemSurface) +
          0.8,
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
    if (this.state === 'racing' || this.state === 'finished' || this.lobby)
      this.spray.update(dt, this.racers, this.track, this.visualTime, itemSurface);
    const control = this.input();
    this.audio.update(
      Math.hypot(p.vx, p.vz),
      p.finished ? 0.65 : control.throttle,
      this.state === 'racing' || this.state === 'finished' || this.state === 'freeride',
    );
    this.intro?.update(dt);
    this.renderer.info.reset();
    this.composer.render();
    this.onRender();
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
    this.pickupVisuals.dispose();
    this.audio.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
