import type { Racer } from './physics';

/** Small contact compression and a settled three-quarter finish view. No horizon roll. */
export class RideCamera {
  private wet = 1;
  private vy = 0;
  private compression = 0;
  private finishTime = 0;
  update(dt: number, rider: Racer, finished: boolean, reducedMotion: boolean) {
    if (!reducedMotion && this.wet === 0 && rider.wet > 0 && this.vy < -2)
      this.compression = Math.min(0.18, -this.vy * 0.012);
    this.compression *= Math.exp(-dt * 7);
    this.wet = rider.wet;
    this.vy = rider.vy;
    this.finishTime = finished ? this.finishTime + dt : 0;
    const t = reducedMotion ? 0 : Math.min(this.finishTime / 1.6, 1),
      finish = t * t * (3 - 2 * t);
    return {
      yawOffset: finish * 0.4,
      distance: 7.2 + finish * 2.2,
      height: 2.9 + finish * 0.35 - (reducedMotion ? 0 : this.compression),
      fov:
        58 +
        (reducedMotion ? 0 : Math.min(Math.hypot(rider.vx, rider.vz) / 32, 1) * 5) -
        finish * 3,
    };
  }
  clear() {
    this.wet = 1;
    this.vy = 0;
    this.compression = 0;
    this.finishTime = 0;
  }
}
