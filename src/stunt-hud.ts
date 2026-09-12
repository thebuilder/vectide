import { STUNT_MESSAGE_SECONDS } from './game/aerial';
import type { Racer } from './game/physics';

/** Brief landing and wipeout feedback, frozen with the simulation when paused. */
export class StuntHud {
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private animation?: Animation;
  private event = '';
  private crashes = 0;
  private wipeoutAt = -Infinity;
  private reduce = false;

  constructor(
    private root: HTMLElement,
    private announcement: HTMLElement,
  ) {}

  clear() {
    this.animation?.cancel();
    this.animation = undefined;
    this.event = '';
    this.crashes = 0;
    this.wipeoutAt = -Infinity;
    this.root.hidden = true;
    this.announcement.textContent = '';
  }

  update(player: Racer, active: boolean, time: number) {
    const air = player.air;
    if (!active || player.finished) {
      this.clear();
      return;
    }
    if (player.recovery.crashes > this.crashes) this.wipeoutAt = time;
    else if (player.recovery.crashes < this.crashes) this.wipeoutAt = -Infinity;
    this.crashes = player.recovery.crashes;
    const wipeoutTime = Math.max(0, STUNT_MESSAGE_SECONDS - (time - this.wipeoutAt));
    const wipeout = wipeoutTime > 0;
    const landed =
      air.messageTime > 0 && air.message.endsWith(' LANDED') && player.recovery.phase === 'riding';
    if (!wipeout && !landed) {
      this.animation?.cancel();
      this.animation = undefined;
      this.root.hidden = true;
      this.event = '';
      this.announcement.textContent = '';
      return;
    }
    const event = wipeout ? `wipeout:${this.crashes}` : `landing:${air.landings}`;
    const message = wipeout ? 'WIPEOUT' : air.message.replace(/ LANDED$/, '');
    const messageTime = wipeout ? wipeoutTime : air.messageTime;
    const fresh = this.event !== event;
    if (fresh || this.reduce !== this.reduced.matches) {
      this.event = event;
      this.reduce = this.reduced.matches;
      this.animation?.cancel();
      this.root.textContent = message;
      this.root.dataset.kind = wipeout ? 'wipeout' : 'stunt';
      if (fresh) this.announcement.textContent = wipeout ? message : air.message;
      this.root.hidden = false;
      const rest = this.reduce ? 'none' : 'translateY(0) scale(1) rotate(-3deg)';
      const edge = this.reduce ? 'none' : 'translateY(24%) scale(0.92) rotate(-4deg)';
      this.animation = this.root.animate(
        [
          { opacity: 0, transform: edge, offset: 0, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
          { opacity: 1, transform: rest, offset: 0.12 },
          { opacity: 1, transform: rest, offset: 0.88, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
          { opacity: 0, transform: edge, offset: 1 },
        ],
        { duration: STUNT_MESSAGE_SECONDS * 1000, fill: 'both' },
      );
      this.animation.pause();
    }
    if (this.animation) this.animation.currentTime = (STUNT_MESSAGE_SECONDS - messageTime) * 1000;
  }
}
