import { ITEMS, ITEM_REVEAL_SECONDS } from './game/pickups';
import type { Racer } from './game/physics';

const GLYPHS = '!<>-_\\/[]{}=+*^?#|';

/** Render from simulation time so pausing and host reconciliation keep the reveal in sync. */
export class PickupHud {
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly name: HTMLElement;
  private readonly announcement: HTMLElement;
  private readonly icon: HTMLElement;
  private readonly description: HTMLElement;
  private readonly use: HTMLElement;
  private frame = -1;
  private held = 0;

  constructor(private readonly root: HTMLElement) {
    this.name = root.querySelector<HTMLElement>('#item-name')!;
    this.announcement = root.querySelector<HTMLElement>('#item-announcement')!;
    this.icon = root.querySelector<HTMLElement>('#item-icon')!;
    this.description = root.querySelector<HTMLElement>('#item-description')!;
    this.use = root.querySelector<HTMLElement>('#item-use')!;
    const label = this.use.querySelector<HTMLElement>('.item-use-label')!;
    for (const color of ['signal', 'azure']) {
      const layer = label.cloneNode(true) as HTMLElement;
      layer.className = `item-use-glitch ${color}`;
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      this.use.append(layer);
    }
  }

  update(player: Racer, active: boolean) {
    const held = active && !player.finished ? player.item : 0;
    this.root.hidden = !held;
    if (!held) {
      this.held = 0;
      this.announcement.textContent = '';
      return;
    }
    const item = ITEMS[held];
    const ready = player.itemReadyIn <= 0;
    this.root.dataset.ready = String(ready);
    this.root.setAttribute('aria-busy', String(!ready));
    this.use.setAttribute('aria-hidden', String(!ready));
    if (held !== this.held) {
      this.frame = -1;
      this.held = held;
      this.icon.textContent = item.icon;
      this.description.textContent = item.description;
      this.root.style.setProperty('--item-color', item.color);
      this.announcement.textContent = '';
    }
    // Finish the text just before the simulation unlocks use.
    const progress = Math.min(1, (ITEM_REVEAL_SECONDS - player.itemReadyIn) / 0.7);
    const frame = Math.floor(((ITEM_REVEAL_SECONDS - player.itemReadyIn) * 1000) / 34);
    if (this.reduced.matches || progress >= 1) {
      if (this.name.textContent !== item.name) this.name.textContent = item.name;
    } else if (frame !== this.frame) {
      const resolved = Math.floor(progress * item.name.length);
      this.name.textContent = [...item.name]
        .map((c, i) =>
          i < resolved || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        )
        .join('');
    }
    this.frame = frame;
    if (ready && !this.announcement.textContent)
      this.announcement.textContent = `${item.name} ready`;
  }
}
