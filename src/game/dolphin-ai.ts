import type { Racer } from './physics';

export interface DolphinAgent {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  turnRate: number;
  mode: 'approach' | 'escort';
  side: number;
  lead: number;
  targetId: number | null;
  interestUntil: number;
  departAt: number;
}

type ClearWater = (x: number, z: number) => boolean;

/** Each swimmer chooses a rider and steers around nearby animals, boats and land. */
export function steerDolphin(
  animal: DolphinAgent,
  pod: readonly DolphinAgent[],
  racers: readonly Racer[],
  clear: ClearWater,
  t: number,
  dt: number,
) {
  let target: Racer | undefined;
  let best = Infinity;
  if (t < animal.interestUntil && animal.departAt === Infinity) {
    for (const racer of racers) {
      const distance = Math.hypot(racer.x - animal.x, racer.z - animal.z);
      if (
        distance > (animal.mode === 'approach' ? 140 : 65) ||
        Math.hypot(racer.vx, racer.vz) < 4 ||
        racer.recovery.phase !== 'riding'
      )
        continue;
      // Keep an existing companion unless another rider is substantially nearer.
      const score = distance - (racer.id === animal.targetId ? 12 : 0);
      if (score < best) {
        target = racer;
        best = score;
      }
    }
  }
  if (
    target &&
    animal.mode === 'approach' &&
    Math.hypot(target.x - animal.x, target.z - animal.z) < 32
  ) {
    animal.mode = 'escort';
    animal.interestUntil = t + 5.8 + Math.abs(animal.side) * 0.1;
  }
  animal.targetId = target?.id ?? null;
  if (!target && animal.departAt === Infinity) animal.departAt = t;
  // Decisions continue in the air, but the takeoff velocity stays ballistic.
  if (dt === 0) return target;

  const speed = Math.hypot(animal.vx, animal.vz);
  let desiredX = animal.vx,
    desiredZ = animal.vz;
  if (target) {
    const pace = Math.hypot(target.vx, target.vz),
      fx = target.vx / pace,
      fz = target.vz / pace;
    const side = animal.side;
    const lead = animal.lead;
    desiredX = target.vx + (target.x + fx * lead + fz * side - animal.x) * 1.15;
    desiredZ = target.vz + (target.z + fz * lead - fx * side - animal.z) * 1.15;
  } else {
    const heading = Math.atan2(animal.vx, animal.vz) + Math.sign(animal.side) * 0.35;
    desiredX = Math.sin(heading) * 15;
    desiredZ = Math.cos(heading) * 15;
  }
  const avoid = (x: number, z: number, radius: number, strength: number) => {
    let dx = animal.x - x,
      dz = animal.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance >= radius) return;
    if (distance < 0.01) {
      dx = Math.sign(animal.side);
      dz = 0;
    }
    const push = ((1 - distance / radius) * strength) / Math.max(distance, 0.01);
    desiredX += dx * push;
    desiredZ += dz * push;
  };
  for (const racer of racers) avoid(racer.x + racer.vx * 0.3, racer.z + racer.vz * 0.3, 12, 36);
  for (const other of pod) if (other !== animal) avoid(other.x, other.z, 5, 14);

  let desiredSpeed = Math.min(29, Math.hypot(desiredX, desiredZ));
  const desiredHeading = Math.atan2(desiredX, desiredZ);
  let safeHeading: number | undefined;
  for (const turn of [0, 0.4, -0.4, 0.85, -0.85, 1.4, -1.4, Math.PI]) {
    const heading = desiredHeading + turn;
    if (
      [2, Math.max(5, speed * 0.55)].every((distance) =>
        clear(animal.x + Math.sin(heading) * distance, animal.z + Math.cos(heading) * distance),
      )
    ) {
      safeHeading = heading;
      break;
    }
  }
  if (safeHeading === undefined) desiredSpeed = 0;
  const currentHeading = animal.yaw;
  const delta = Math.atan2(
    Math.sin((safeHeading ?? currentHeading) - currentHeading),
    Math.cos((safeHeading ?? currentHeading) - currentHeading),
  );
  const desiredTurn = Math.max(-1.5, Math.min(1.5, delta * 2.5));
  animal.turnRate += (desiredTurn - animal.turnRate) * (1 - Math.exp(-dt * 5));
  const heading = currentHeading + animal.turnRate * dt;
  if (Math.abs(delta) > 1) desiredSpeed *= 0.65;
  const nextSpeed = speed + Math.max(-dt * 14, Math.min(dt * 6, desiredSpeed - speed));
  animal.yaw = heading;
  animal.vx = Math.sin(heading) * nextSpeed;
  animal.vz = Math.cos(heading) * nextSpeed;
  if (!clear(animal.x + animal.vx * dt, animal.z + animal.vz * dt)) {
    animal.vx = 0;
    animal.vz = 0;
  }
  return target;
}
