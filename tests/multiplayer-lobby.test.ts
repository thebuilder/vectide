import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { TRACKS } from '../src/game/tracks';
import { createLobbyRacers, lobbyCamera } from '../src/multiplayer/lobby';

it('keeps ten named craft separated and visible on a phone for every course', () => {
  const members = Array.from({ length: 10 }, (_, slot) => ({
    slot,
    name: `RACER ${slot}`,
    color: slot,
    connected: true,
  }));
  for (const track of TRACKS) {
    const racers = createLobbyRacers(track, members);
    const view = lobbyCamera(track, racers.length, 375 / 667);
    const camera = new PerspectiveCamera(62, 375 / 667, 0.1, 5000);
    camera.setViewOffset(375, 667, 0, 667 * 0.17, 375, 667);
    camera.position.set(view.position.x, view.position.y, view.position.z);
    camera.lookAt(view.target.x, view.target.y, view.target.z);
    camera.updateMatrixWorld();
    for (const racer of racers) {
      const point = new Vector3(racer.x, racer.y, racer.z).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(0.92);
      expect(Math.abs(point.y)).toBeLessThan(0.6);
      for (const other of racers)
        if (other !== racer)
          expect(Math.hypot(racer.x - other.x, racer.z - other.z)).toBeGreaterThan(5);
    }
    expect(racers.map((r) => r.name)).toEqual(members.map((m) => m.name));
  }
});
