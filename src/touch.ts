import { cancelTrickSetup } from './game/aerial';
import type { Engine, Snapshot } from './game/engine';
/** Each finger owns one virtual key until release, cancellation, or a state change. */
export class TouchControls {
  private stuck = false;
  private stuckSince: number | null = null;
  private held = new Map<number, string>();
  constructor(
    private engine: Engine,
    private root: HTMLElement,
  ) {
    root.addEventListener('pointerdown', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-touch-key]');
      if (!target || !['racing', 'freeride', 'countdown'].includes(engine.state)) return;
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
      if (key === 'item') engine.useItem();
      this.held.set(event.pointerId, key);
      this.apply();
    });
    const release = (event: PointerEvent) => {
      if (this.held.get(event.pointerId) === 'flip' && event.type !== 'pointerup')
        cancelTrickSetup(engine.player);
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
    this.root.querySelector<HTMLElement>('[data-touch-key="item"]')!.hidden =
      state !== 'racing' || !player.item;
    this.root.querySelector<HTMLButtonElement>('[data-touch-key="item"]')!.disabled =
      player.itemReadyIn > 0;
    const mounted = player.recovery.phase === 'riding';
    const stalled =
      state === 'racing' &&
      document.body.dataset.input === 'touch' &&
      !this.engine.touchInput.brake &&
      speed < 3;
    this.stuckSince = stalled ? (this.stuckSince ?? time) : null;
    const offCourse =
      state === 'racing' &&
      Math.min(...track.points.map((p) => Math.hypot(p.x - player.x, p.z - player.z))) > 45;
    if (state !== 'racing' || speed > 6) this.stuck = false;
    if (this.stuckSince !== null && time - this.stuckSince >= 2) this.stuck = true;
    const needsReset =
      mounted &&
      (state === 'freeride' || (state === 'racing' && (missed || offCourse || this.stuck)));
    this.root.querySelector<HTMLElement>('[data-touch-key="reset"]')!.hidden = !needsReset;
    const driving =
      document.body.dataset.input === 'touch' &&
      mounted &&
      !this.engine.onlineMenuOpen &&
      (state === 'racing' || state === 'freeride' || state === 'countdown');
    if (!driving) this.clear();
    this.root.inert = !driving;
  }
  private clear() {
    if (this.held.size) cancelTrickSetup(this.engine.player);
    this.held.clear();
    this.apply();
  }
  private apply() {
    const pressed = new Set(this.held.values());
    Object.assign(this.engine.touchInput, {
      throttle: 0,
      brake: Number(pressed.has('brake')),
      steer: Number(pressed.has('left')) - Number(pressed.has('right')),
      lean: 0,
      trick: Number(pressed.has('flip')),
      use: pressed.has('item'),
    });
    this.root
      .querySelectorAll<HTMLElement>('[data-touch-key]')
      .forEach((button) => button.classList.toggle('held', pressed.has(button.dataset.touchKey!)));
  }
}
