import { STUNT_MESSAGE_SECONDS } from './game/aerial';
import type { Racer } from './game/physics';

/** One landing event, with motion driven by simulation time so pause freezes it. */
export class StuntHud {
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private animation?: Animation;
  private landings = 0;
  private reduce = false;

  constructor(
    private root: HTMLElement,
    private announcement: HTMLElement,
  ) {}

  clear() {
    this.animation?.cancel();
    this.animation = undefined;
    this.landings = 0;
    this.root.hidden = true;
    this.announcement.textContent = '';
  }

  update(player: Racer, active: boolean) {
    const air = player.air;
    if (!active || player.finished) {
      this.clear();
      return;
    }
    if (
      air.messageTime <= 0 ||
      !air.message.endsWith(' LANDED') ||
      player.recovery.phase !== 'riding'
    ) {
      this.animation?.cancel();
      this.animation = undefined;
      this.root.hidden = true;
      this.landings = air.landings;
      this.announcement.textContent = '';
      return;
    }
    const fresh = this.landings !== air.landings;
    if (fresh || this.reduce !== this.reduced.matches) {
      this.landings = air.landings;
      this.reduce = this.reduced.matches;
      this.animation?.cancel();
      this.root.textContent = air.message.replace(/ LANDED$/, '');
      if (fresh) this.announcement.textContent = air.message;
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
    if (this.animation)
      this.animation.currentTime = (STUNT_MESSAGE_SECONDS - air.messageTime) * 1000;
  }
}
