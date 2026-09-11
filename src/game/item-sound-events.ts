import type { Racer } from './physics';
import type { Pickups } from './pickups';

/** Observe confirmed inventory changes, including host snapshots on multiplayer guests. */
export class ItemSoundEvents {
  private source?: Pickups;
  private player = -1;
  private held = 0;
  constructor(private sound: { pickup(): void; useItem(item: number): void }) {}
  update(items: Pickups, player: Racer, active: boolean) {
    if (this.source === items && this.player === player.id && active && items.enabled) {
      if (!this.held && player.item) this.sound.pickup();
      else if (this.held && !player.item && player.recovery.phase === 'riding')
        this.sound.useItem(this.held);
    }
    this.source = items;
    this.player = player.id;
    this.held = player.item;
  }
}
