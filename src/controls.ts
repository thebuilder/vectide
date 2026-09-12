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
        this.setDevice(event.pointerType === 'touch' ? 'touch' : 'keyboard');
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
  private get dialog() {
    return [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
  }
  private targets() {
    const root = this.dialog ?? document;
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button,summary,a[href],input:not([type=hidden]),select,textarea',
      ),
    ).filter(
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
    if (dx && current instanceof HTMLInputElement && current.type === 'range') {
      if (dx > 0) current.stepUp(5);
      else current.stepDown(5);
      current.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const from = current.getBoundingClientRect();
    const candidates = targets
      .filter((element) => element !== current)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const gap =
          dx > 0
            ? rect.left - from.right
            : dx < 0
              ? from.left - rect.right
              : dy > 0
                ? rect.top - from.bottom
                : from.top - rect.bottom;
        const overlap = dx
          ? Math.min(from.bottom, rect.bottom) - Math.max(from.top, rect.top)
          : Math.min(from.right, rect.right) - Math.max(from.left, rect.left);
        const side = dx
          ? Math.abs(rect.top + rect.height / 2 - from.top - from.height / 2)
          : Math.abs(rect.left + rect.width / 2 - from.left - from.width / 2);
        return { element, gap, overlap, side };
      })
      // Horizontal movement stays in the row. Vertical movement may enter a staggered row.
      .filter(({ gap, overlap }) => gap >= -2 && (!dx || overlap > 2));
    // Finish navigating a scroll panel before moving to its fixed surrounding actions.
    let panel = current.parentElement;
    while (
      panel &&
      !(
        panel.scrollHeight > panel.clientHeight &&
        /auto|scroll/.test(getComputedStyle(panel).overflowY)
      )
    ) {
      panel = panel.parentElement;
    }
    const inside = panel ? candidates.filter(({ element }) => panel.contains(element)) : [];
    const rowCandidates = inside.length ? inside : candidates;
    const nearest = Math.min(...rowCandidates.map(({ gap }) => gap));
    const next = rowCandidates
      // Controls in one row can differ slightly in height and padding.
      .filter(({ gap }) => gap <= nearest + 12)
      .sort((a, b) => Number(b.overlap > 0) - Number(a.overlap > 0) || a.side - b.side)[0];
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
    const dialog = this.dialog;
    if (dialog?.id === 'pause-dialog') this.engine.pause();
    else if (dialog?.id === 'results') document.getElementById('result-exit')?.click();
    else if (this.engine.state === 'lobby') document.getElementById('leave-room')?.click();
    else if (dialog?.id === 'online-dialog') document.getElementById('cancel-online')?.click();
    else if (!dialog && this.engine.state === 'menu') {
      const back = document.getElementById('setup-back');
      if (back && !back.hidden && !back.closest('[inert]')) back.click();
    } else if (dialog) dialog.close();
  }
  private key = (event: KeyboardEvent) => {
    this.setDevice('keyboard');
    if (event.code === 'Escape' && this.dialog?.id === 'help-dialog') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.back();
      return;
    }
    if (
      !this.navigating ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.target instanceof HTMLElement &&
        event.target.matches('input,textarea,select,[contenteditable]') &&
        !(
          event.target.matches('input[type=range]') &&
          ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)
        ))
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
    if (edge(9) && this.dialog?.id === 'help-dialog') this.back();
    else if (edge(9) && ['racing', 'freeride', 'countdown', 'paused'].includes(this.engine.state))
      this.engine.pause();
    else if (edge(1) && this.engine.state === 'freeride') this.engine.pause();
    else if (this.navigating) {
      if (edge(0)) this.activate();
      if (edge(1)) this.back();
      const horizontal = Number(pressed[15]) - Number(pressed[14]);
      const vertical = Number(pressed[13]) - Number(pressed[12]);
      const stickX = pad.axes[0] ?? 0;
      const stickY = pad.axes[1] ?? 0;
      const x =
        horizontal ||
        (!vertical && Math.abs(stickX) > 0.55 && Math.abs(stickX) >= Math.abs(stickY)
          ? Math.sign(stickX)
          : 0);
      const y = vertical || (!horizontal && !x && Math.abs(stickY) > 0.55 ? Math.sign(stickY) : 0);
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
