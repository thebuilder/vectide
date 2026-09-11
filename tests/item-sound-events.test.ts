import { it, expect, vi } from 'vitest';
import { ItemSoundEvents } from '../src/game/item-sound-events';
import { createRacer } from '../src/game/physics';
import { Pickups } from '../src/game/pickups';
import { TRACKS } from '../src/game/tracks';

it('cues each collected and consumed item once, including inventory from remote snapshots', () => {
  const sound = { pickup: vi.fn(), useItem: vi.fn() };
  const events = new ItemSoundEvents(sound);
  const items = new Pickups(TRACKS[0], true);
  const player = createRacer(TRACKS[0], 0);
  events.update(items, player, true);
  for (let item = 1; item <= 6; item++) {
    Object.assign(player, structuredClone({ item, itemReadyIn: 0.8 }));
    for (let frame = 0; frame < 60; frame++) events.update(items, player, true);
    expect(sound.pickup).toHaveBeenCalledTimes(item);
    // Clearing inventory is host-authoritative. Input presses alone do not play a cue.
    Object.assign(player, structuredClone({ item: 0, itemReadyIn: 0 }));
    for (let frame = 0; frame < 60; frame++) events.update(items, player, true);
    expect(sound.useItem).toHaveBeenCalledTimes(item);
    expect(sound.useItem).toHaveBeenLastCalledWith(item);
  }
});
it('does not replay stale pickups or item activations after pause, restart, or changing players', () => {
  const sound = { pickup: vi.fn(), useItem: vi.fn() };
  const events = new ItemSoundEvents(sound);
  const items = new Pickups(TRACKS[0], true);
  const player = createRacer(TRACKS[0], 0);
  player.item = 4;
  events.update(items, player, true);
  player.item = 0;
  events.update(items, player, false);
  events.update(items, player, true);
  player.item = 2;
  events.update(new Pickups(TRACKS[0], true), player, true);
  player.id = 1;
  player.item = 0;
  events.update(items, player, true);
  expect(sound.pickup).not.toHaveBeenCalled();
  expect(sound.useItem).not.toHaveBeenCalled();
});
