import type { Input, Racer } from './physics';
export interface RiderLoad {
  side: number;
  fore: number;
  compression: number;
  foot: number;
  impact: number;
  airtime: number;
}
export function createRiderLoad(): RiderLoad {
  return { side: 0, fore: 0, compression: 0.1, foot: 0, impact: 0, airtime: 0 };
}
const limit = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
/** Physical weight distribution advances with the hull at 120 Hz, never at render rate. */
export function stepRiderLoad(r: Racer, input: Input, dt: number): void {
  const body = r.body,
    speed = Math.hypot(r.vx, r.vz);
  body.impact *= Math.exp(-dt * 5);
  const supported = r.wet > 0 || r.onRamp;
  const side = input.steer * limit(speed / 16, 0, 1) * 0.72;
  // The automatic stance braces for water entry; manual fore/aft input adds weight transfer.
  const fore = limit(input.lean * 0.8 + (supported ? -0.08 * input.throttle : -0.12), -0.8, 0.8);
  const compression = supported
    ? limit(
        0.1 + body.impact * 0.034 + Math.abs(side) * 0.08 + Math.min(1, r.air.charge / 0.3) * 0.22,
        0.06,
        0.44,
      )
    : r.vy < -2
      ? 0.23
      : 0.07;
  body.side += (side - body.side) * (1 - Math.exp(-dt * 7));
  body.fore += (fore - body.fore) * (1 - Math.exp(-dt * 8));
  body.compression += (compression - body.compression) * (1 - Math.exp(-dt * 15));
  const foot =
    r.wet > 0 && !r.onRamp && speed > 7 && Math.abs(body.side) > 0.35 && r.roll * body.side < 0
      ? Math.sign(body.side) * limit((Math.abs(r.roll) - Math.PI / 4) / (Math.PI / 12), 0, 1)
      : 0;
  body.foot += (foot - body.foot) * (1 - Math.exp(-dt * 8));
}
