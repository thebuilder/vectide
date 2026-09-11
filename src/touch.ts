import { cancelTrickSetup } from './game/aerial';
import type { Engine, Snapshot } from './game/engine';
/** Pointer capture keeps the stick and action buttons independent during a drag. */
export class TouchControls {
  private stuck = false;
  private stuckSince: number | null = null;
  private stick?: { pointer: number; x: number; y: number; radius: number };
  private steer = 0;
  private lean = 0;
  private held = new Map<number, string>();
  constructor(
    private engine: Engine,
    private root: HTMLElement,
  ) {
    root.addEventListener('pointerdown', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-touch-key]');
      if (
        !target ||
        target.disabled ||
        root.inert ||
        !['racing', 'freeride', 'countdown'].includes(engine.state)
      )
        return;
      const key = target.dataset.touchKey!;
      if (key === 'stick' && this.stick) return;
      event.preventDefault();
      target.setPointerCapture(event.pointerId);
      if (key === 'stick') {
        const bounds = target.getBoundingClientRect();
        this.stick = {
          pointer: event.pointerId,
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
          radius: bounds.width * 0.32,
        };
        this.moveStick(event);
      }
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
    root.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.stick?.pointer) return;
      event.preventDefault();
      this.moveStick(event);
      this.apply();
    });
    const release = (event: PointerEvent) => {
      if (this.held.get(event.pointerId) === 'flip' && event.type !== 'pointerup')
        cancelTrickSetup(engine.player);
      if (event.pointerId === this.stick?.pointer) this.resetStick();
      this.held.delete(event.pointerId);
      this.apply();
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('lostpointercapture', release);
    root.addEventListener('contextmenu', (event) => event.preventDefault());
    root.addEventListener('selectstart', (event) => event.preventDefault());
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
    const riding = state === 'racing' || state === 'freeride';
    const stalled =
      riding &&
      mounted &&
      !this.engine.onlineMenuOpen &&
      document.body.dataset.input === 'touch' &&
      !this.engine.touchInput.brake &&
      speed < 3;
    this.stuckSince = stalled ? (this.stuckSince ?? time) : null;
    const offCourse =
      state === 'racing' &&
      Math.min(...track.points.map((p) => Math.hypot(p.x - player.x, p.z - player.z))) > 45;
    if (!riding || !mounted || this.engine.onlineMenuOpen || speed > 6) this.stuck = false;
    if (this.stuckSince !== null && time - this.stuckSince >= 2) this.stuck = true;
    const needsReset =
      mounted &&
      !this.engine.onlineMenuOpen &&
      riding &&
      (this.stuck || (state === 'racing' && (missed || offCourse)));
    this.root.querySelector<HTMLElement>('[data-touch-key="reset"]')!.hidden = !needsReset;
    const driving =
      document.body.dataset.input === 'touch' &&
      mounted &&
      !this.engine.onlineMenuOpen &&
      (state === 'racing' || state === 'freeride' || state === 'countdown');
    if (!driving) this.clear();
    this.root.inert = !driving;
  }
  private moveStick(event: PointerEvent) {
    if (!this.stick) return;
    const x = (event.clientX - this.stick.x) / this.stick.radius;
    const y = (event.clientY - this.stick.y) / this.stick.radius;
    const distance = Math.hypot(x, y);
    const magnitude = Math.max(0, Math.min(1, (distance - 0.1) / 0.9));
    this.steer = distance ? (-x / distance) * magnitude : 0;
    this.lean = distance ? (y / distance) * magnitude : 0;
    this.root.style.setProperty('--stick-x', `${-this.steer * this.stick.radius}px`);
    this.root.style.setProperty('--stick-y', `${this.lean * this.stick.radius}px`);
  }
  private resetStick() {
    this.stick = undefined;
    this.steer = this.lean = 0;
    this.root.style.setProperty('--stick-x', '0px');
    this.root.style.setProperty('--stick-y', '0px');
  }
  private clear() {
    if (this.held.size) cancelTrickSetup(this.engine.player);
    const pointers = [...this.held.keys()];
    this.held.clear();
    this.resetStick();
    this.root.querySelectorAll<HTMLElement>('[data-touch-key]').forEach((button) => {
      for (const pointer of pointers)
        if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
    });
    this.apply();
  }
  private apply() {
    const pressed = new Set(this.held.values());
    Object.assign(this.engine.touchInput, {
      throttle: 0,
      brake: Number(pressed.has('brake')),
      steer: this.steer,
      lean: this.lean,
      trick: Number(pressed.has('flip')),
      use: pressed.has('item'),
    });
    this.root
      .querySelectorAll<HTMLElement>('[data-touch-key]')
      .forEach((button) => button.classList.toggle('held', pressed.has(button.dataset.touchKey!)));
  }
}
