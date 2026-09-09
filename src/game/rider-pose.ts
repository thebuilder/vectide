import { Matrix4, Quaternion, Vector3 } from 'three';
import { clamp, type Racer } from './physics';
export interface RiderPose {
  compression: number;
  lean: number;
  forward: number;
  impact: number;
  previousVy: number;
  previousSpeed: number;
  previousWet: number;
}
export function createRiderPose(): RiderPose {
  return {
    compression: 0.1,
    lean: 0,
    forward: 0.12,
    impact: 0,
    previousVy: 0,
    previousSpeed: 0,
    previousWet: 1,
  };
}
/** Hull acceleration drives suspension in the legs; landing impulses decay instead of snapping. */
export function stepRiderPose(p: RiderPose, r: Racer, dt: number): void {
  if (dt <= 0) return;
  const speed = Math.hypot(r.vx, r.vz),
    vertical = clamp((r.vy - p.previousVy) / dt, -18, 24),
    acceleration = clamp((speed - p.previousSpeed) / dt, -20, 26);
  if (p.previousWet === 0 && r.wet > 0) p.impact = Math.max(p.impact, Math.min(10, -p.previousVy));
  p.impact *= Math.exp(-dt * 8);
  const compression =
    r.wet === 0
      ? r.vy < -2
        ? 0.18
        : 0.06
      : clamp(0.1 + vertical * 0.008 + speed * 0.0008 + p.impact * 0.022, 0.04, 0.36);
  const lean = r.body.side * 0.78;
  const forward = clamp(
    0.12 + acceleration * 0.002 + r.pitch * 0.85 - r.body.fore * 0.42 + (r.wet === 0 ? 0.04 : 0),
    -0.4,
    0.65,
  );
  p.compression +=
    (Math.max(compression, r.body.compression) - p.compression) * (1 - Math.exp(-dt * 16));
  p.lean += (lean - p.lean) * (1 - Math.exp(-dt * 11));
  p.forward += (forward - p.forward) * (1 - Math.exp(-dt * 9));
  p.previousVy = r.vy;
  p.previousSpeed = speed;
  p.previousWet = r.wet;
}
/** Analytic two-bone IK. The pole chooses a natural knee/elbow bend without moving the contact. */
export function solveJoint(
  root: Vector3,
  end: Vector3,
  upper: number,
  lower: number,
  pole: Vector3,
): Vector3 {
  const direction = end.clone().sub(root),
    distance = clamp(direction.length(), 0.001, upper + lower - 0.0001);
  direction.normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const bend = pole.clone().sub(root);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 0.00001) bend.set(0, 0, 1).addScaledVector(direction, -direction.z);
  bend.normalize();
  return root
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
}

export interface ContactConstraint {
  offset: Vector3;
  target: Vector3;
  reach: number;
}

/** Point the limb toward its joint while keeping protective panels facing forward. */
export function boneOrientation(a: Vector3, b: Vector3, front = new Vector3(0, 0, 1)): Quaternion {
  const y = b.clone().sub(a).normalize();
  const z = front.clone().addScaledVector(y, -front.dot(y));
  if (z.lengthSq() < 0.00001) z.set(0, 1, 0).addScaledVector(y, -y.y);
  z.normalize();
  const x = y.clone().cross(z).normalize();
  z.copy(x).cross(y).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}
/** Keep the torso inside the reach of all four limbs before solving the individual joints. */
export function fitRootToContacts(root: Vector3, contacts: ContactConstraint[]): void {
  const delta = new Vector3();
  for (let iteration = 0; iteration < 32; iteration++) {
    let correction = 0;
    for (const contact of contacts) {
      delta.copy(root).add(contact.offset).sub(contact.target);
      const distance = delta.length();
      const excess = distance - contact.reach;
      if (excess > 0) {
        root.addScaledVector(delta, -excess / distance);
        correction = Math.max(correction, excess);
      }
    }
    if (correction < 0.000001) break;
  }
}
