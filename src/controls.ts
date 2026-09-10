import type { Engine } from './game/engine';

/** Menu actions use press edges; held directions repeat after a deliberate delay. */
export class Controls {
  private buttons: boolean[] = [];
  private direction = '';
  private repeatAt = 0;
  private device: 'keyboard' | 'gamepad' | 'touch' | undefined;
  constructor(private engine: Engine) {
    window.addEventListener('keydown', this.key, true);
    window.addEventListener('gamepaddisconnected', () =>
      this.setDevice(matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard'),
    );
    window.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'touch') this.setDevice('touch');
      },
      true,
    );
    this.setDevice(matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard');
  }
  private setDevice(device: 'keyboard' | 'gamepad' | 'touch') {
    if (this.device === device) return;
    this.device = device;
    document.body.dataset.input = device;
    document.querySelectorAll<HTMLElement>('[data-keyboard]').forEach((element) => {
      element.textContent = element.dataset[device] ?? '';
    });
  }
  private get navigating() {
    return (
      !!document.querySelector('dialog[open]') ||
      this.engine.state === 'menu' ||
      this.engine.state === 'lobby' ||
      this.engine.state === 'finished'
    );
  }
  private targets() {
    const root = document.querySelector('dialog[open]') ?? document;
    return Array.from(root.querySelectorAll<HTMLElement>('button,summary,a[href]')).filter(
      (element) =>
        !element.closest('[hidden],[inert]') &&
        !element.matches(':disabled') &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden' &&
        Number(getComputedStyle(element).opacity) > 0.1,
    );
  }
  private move(dx: number, dy: number) {
    const targets = this.targets();
    const current = document.activeElement as HTMLElement;
    if (!targets.includes(current)) {
      (targets.find((e) => e.matches('#open-setup,.course.selected')) ?? targets[0])?.focus();
      return;
    }
    const from = current.getBoundingClientRect();
    const x = from.x + from.width / 2,
      y = from.y + from.height / 2;
    const next = targets
      .filter((e) => e !== current)
      .map((element) => {
        const r = element.getBoundingClientRect();
        const vx = r.x + r.width / 2 - x,
          vy = r.y + r.height / 2 - y;
        const forward = vx * dx + vy * dy,
          side = Math.abs(vx * dy - vy * dx);
        return { element, forward, score: forward + side * 3 };
      })
      .filter((e) => e.forward > 8)
      .sort((a, b) => a.score - b.score)[0];
    next?.element.focus();
  }
  private activate() {
    const targets = this.targets();
    const target = targets.includes(document.activeElement as HTMLElement)
      ? (document.activeElement as HTMLElement)
      : targets[0];
    target?.click();
  }
  private back() {
    const picker = document.querySelector<HTMLDetailsElement>('.song-picker[open]');
    if (picker) {
      picker.open = false;
      picker.querySelector('summary')?.focus();
      return;
    }
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog?.id === 'pause-dialog') this.engine.pause();
    else if (dialog?.id === 'results') document.getElementById('result-exit')?.click();
    else if (this.engine.state === 'lobby') document.getElementById('leave-room')?.click();
    else if (dialog?.id === 'online-dialog') document.getElementById('cancel-online')?.click();
    else if (!dialog && this.engine.state === 'menu') {
      const back = document.getElementById('setup-back');
      if (back && !back.closest('[inert]')) back.click();
    } else if (dialog) {
      dialog.close();
      document.getElementById('help')?.focus();
    }
  }
  private key = (event: KeyboardEvent) => {
    this.setDevice('keyboard');
    if (
      !this.navigating ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.target instanceof HTMLElement &&
        event.target.matches('input,textarea,select,[contenteditable]'))
    )
      return;
    if (event.code === 'Escape' && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      this.back();
      return;
    }
    const directions: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      KeyW: [0, -1],
      ArrowDown: [0, 1],
      KeyS: [0, 1],
      ArrowLeft: [-1, 0],
      KeyA: [-1, 0],
      ArrowRight: [1, 0],
      KeyD: [1, 0],
    };
    if (directions[event.code]) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.move(...directions[event.code]);
    } else if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) this.activate();
    }
  };
  poll(now: number) {
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (!pad) {
      this.buttons = [];
      this.direction = '';
      if (this.device === 'gamepad')
        this.setDevice(matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard');
      return;
    }
    const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const edge = (i: number) => pressed[i] && !this.buttons[i];
    if (pressed.some((p, i) => p && !this.buttons[i]) || pad.axes.some((a) => Math.abs(a) > 0.25))
      this.setDevice('gamepad');
    if (edge(9) && ['racing', 'freeride', 'countdown', 'paused'].includes(this.engine.state))
      this.engine.pause();
    else if (edge(1) && this.engine.state === 'freeride') this.engine.pause();
    else if (this.navigating) {
      if (edge(0)) this.activate();
      if (edge(1)) this.back();
      const x = pressed[14]
        ? -1
        : pressed[15]
          ? 1
          : Math.abs(pad.axes[0] ?? 0) > 0.55
            ? Math.sign(pad.axes[0])
            : 0;
      const y = pressed[12]
        ? -1
        : pressed[13]
          ? 1
          : Math.abs(pad.axes[1] ?? 0) > 0.55
            ? Math.sign(pad.axes[1])
            : 0;
      const direction = x ? `${x},0` : y ? `0,${y}` : '';
      if (direction && (direction !== this.direction || now >= this.repeatAt)) {
        this.move(x ? x : 0, x ? 0 : y);
        this.repeatAt = now + (direction === this.direction ? 140 : 380);
      }
      this.direction = direction;
    } else if (edge(2)) this.engine.reset();
    this.buttons = pressed;
  }
}
