import type { Engine, State } from './game/engine';
/** Each finger owns one virtual key until release, cancellation, or a state change. */
export class TouchControls {
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
        return;
      }
      this.held.set(event.pointerId, key);
      this.apply();
    });
    const release = (event: PointerEvent) => {
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
  sync(state: State) {
    const driving = state === 'racing' || state === 'countdown';
    if (!driving) this.clear();
    this.root.inert = !driving;
  }
  private clear() {
    this.held.clear();
    this.apply();
  }
  private apply() {
    const pressed = new Set(this.held.values());
    Object.assign(this.engine.touchInput, {
      throttle: Number(pressed.has('throttle')),
      brake: Number(pressed.has('brake')),
      steer: Number(pressed.has('left')) - Number(pressed.has('right')),
      lean: Number(pressed.has('lean')),
    });
    this.root
      .querySelectorAll<HTMLElement>('[data-touch-key]')
      .forEach((button) => button.classList.toggle('held', pressed.has(button.dataset.touchKey!)));
  }
}
