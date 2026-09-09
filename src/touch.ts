import { cancelTrickSetup } from './game/aerial';
import type { Engine, Snapshot } from './game/engine';
/** Each finger owns one virtual key until release, cancellation, or a state change. */
export class TouchControls {
  private stuck = false;
  private stuckSince: number | null = null;
  private gestures = new Map<number, { x: number; y: number; used: boolean }>();
  private trick = 0;
  private held = new Map<number, string>();
  constructor(
    private engine: Engine,
    private root: HTMLElement,
  ) {
    root.addEventListener('pointerdown', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-touch-key]');
      if (!target || !['racing', 'countdown'].includes(engine.state)) return;
      event.preventDefault();
      target.setPointerCapture(event.pointerId);
      const key = target.dataset.touchKey!;
      if (key === 'reset') {
        engine.reset();
        this.stuckSince = null;
        this.stuck = false;
        target.hidden = true;
        return;
      }
      if (key === 'throttle')
        this.gestures.set(event.pointerId, { x: event.clientX, y: event.clientY, used: false });
      this.held.set(event.pointerId, key);
      this.apply();
    });
    root.addEventListener('pointermove', (event) => {
      const gesture = this.gestures.get(event.pointerId);
      if (!gesture || gesture.used) return;
      const dx = event.clientX - gesture.x,
        dy = event.clientY - gesture.y;
      if (Math.max(Math.abs(dx), -dy) < 28) return;
      this.trick = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : -2) : dy < 0 ? 1 : 0;
      if (this.trick) {
        gesture.used = true;
        this.apply();
      }
    });
    const release = (event: PointerEvent) => {
      if (this.gestures.has(event.pointerId)) {
        this.trick = 0;
        if (event.type !== 'pointerup') cancelTrickSetup(engine.racers[0]);
      }
      this.gestures.delete(event.pointerId);
      this.held.delete(event.pointerId);
      this.apply();
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('lostpointercapture', release);
    root.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    window.addEventListener('resize', () => this.clear());
  }
  sync(snapshot: Snapshot) {
    const { state, player, track, time, speed, missed } = snapshot;
    const mounted = player.recovery.phase === 'riding';
    const stalled = state === 'racing' && this.engine.touchInput.throttle > 0 && speed < 3;
    this.stuckSince = stalled ? (this.stuckSince ?? time) : null;
    const offCourse =
      state === 'racing' &&
      Math.min(...track.points.map((p) => Math.hypot(p.x - player.x, p.z - player.z))) > 45;
    if (state !== 'racing' || speed > 6) this.stuck = false;
    if (this.stuckSince !== null && time - this.stuckSince >= 2) this.stuck = true;
    const needsReset = state === 'racing' && mounted && (missed || offCourse || this.stuck);
    this.root.querySelector<HTMLElement>('[data-touch-key="reset"]')!.hidden = !needsReset;
    const driving = mounted && (state === 'racing' || state === 'countdown');
    if (!driving) this.clear();
    this.root.inert = !driving;
  }
  private clear() {
    cancelTrickSetup(this.engine.racers[0]);
    this.held.clear();
    this.gestures.clear();
    this.trick = 0;
    this.apply();
  }
  private apply() {
    const pressed = new Set(this.held.values());
    Object.assign(this.engine.touchInput, {
      throttle: Number(pressed.has('throttle')),
      brake: Number(pressed.has('brake')),
      steer: Number(pressed.has('left')) - Number(pressed.has('right')),
      lean: 0,
      trick: this.trick,
    });
    this.root
      .querySelectorAll<HTMLElement>('[data-touch-key]')
      .forEach((button) => button.classList.toggle('held', pressed.has(button.dataset.touchKey!)));
  }
}
