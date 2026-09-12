import * as T from 'three';
import type { Racer } from './physics';
import type { Track } from './tracks';
import { waterHeight, type WaterProfile } from './water';

/** Solid water fragments and floating foam, emitted from hull contacts and landing impacts. */
export class VoxelSpray {
  readonly object: T.InstancedMesh;
  private positions: Float32Array;
  private velocities: Float32Array;
  private life: Float32Array;
  private duration: Float32Array;
  private sizes: Float32Array;
  private foam: Uint8Array;
  private cursor = 0;
  private emission = new Map<number, number>();
  private lastWet = new Map<number, number>();
  private lastVy = new Map<number, number>();
  private cooldown = new Map<number, number>();
  private dummy = new T.Object3D();
  private white = new T.Color('#ddfff3');
  private blue = new T.Color('#87dfcf');
  activeCount = 0;

  constructor(private readonly capacity = 4200) {
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.duration = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.foam = new Uint8Array(capacity);
    this.object = new T.InstancedMesh(
      new T.TetrahedronGeometry(0.85),
      new T.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.65,
        flatShading: true,
        metalness: 0.08,
        emissive: 0x3c8d7c,
        emissiveIntensity: 0.2,
      }),
      this.capacity,
    );
    this.object.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.object.frustumCulled = false;
    this.clear();
  }
  clear() {
    this.life.fill(0);
    this.lastWet.clear();
    this.lastVy.clear();
    this.cooldown.clear();
    this.emission.clear();
    this.activeCount = 0;
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.capacity; i++) this.object.setMatrixAt(i, this.dummy.matrix);
    this.object.instanceMatrix.needsUpdate = true;
  }
  burst(x: number, y: number, z: number, strength = 1) {
    for (let n = 0; n < Math.ceil(140 * strength); n++) {
      const i = this.cursor++ % this.capacity,
        j = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const speed = (5 + Math.random() * 14) * Math.sqrt(strength);
      this.foam[i] = 0;
      this.duration[i] = this.life[i] = 0.9 + Math.random() * 0.8;
      this.sizes[i] = (0.12 + Math.random() * 0.35) * (0.5 + strength * 0.5);
      this.positions[j] = x + Math.sin(theta) * 0.7;
      this.positions[j + 1] = y + 0.4;
      this.positions[j + 2] = z + Math.cos(theta) * 0.7;
      this.velocities[j] = Math.sin(theta) * speed;
      this.velocities[j + 1] = (4 + Math.random() * 12) * Math.sqrt(strength);
      this.velocities[j + 2] = Math.cos(theta) * speed;
      this.object.setColorAt(i, n % 4 ? this.white : this.blue);
    }
  }
  /** A small surface trail for swimmers, without a hull's powered spray. */
  foamTrail(x: number, z: number, vx: number, vz: number) {
    const speed = Math.max(1, Math.hypot(vx, vz));
    for (const side of [-1, 1]) {
      const i = this.cursor++ % this.capacity,
        j = i * 3;
      this.foam[i] = 1;
      this.duration[i] = this.life[i] = 0.7 + Math.random() * 0.35;
      this.sizes[i] = 0.24 + Math.random() * 0.16;
      this.positions[j] = x - (vx / speed) * 1.2 + (vz / speed) * side * 0.3;
      this.positions[j + 2] = z - (vz / speed) * 1.2 - (vx / speed) * side * 0.3;
      this.velocities[j] = vx * 0.06 + (vz / speed) * side * 0.7;
      this.velocities[j + 1] = 0;
      this.velocities[j + 2] = vz * 0.06 - (vx / speed) * side * 0.7;
      this.object.setColorAt(i, this.white);
    }
  }
  private emit(r: Racer, side: number, impact: number, isFoam: boolean) {
    const i = this.cursor++ % this.capacity,
      j = i * 3,
      fx = Math.sin(r.yaw),
      fz = Math.cos(r.yaw),
      speed = Math.hypot(r.vx, r.vz),
      pace = Math.min(speed / 22, 1),
      strength = Math.max(pace, Math.min(impact / 8, 1));
    this.foam[i] = isFoam ? 1 : 0;
    this.duration[i] = this.life[i] = isFoam
      ? 0.35 + strength * (0.95 + Math.random() * 0.8)
      : 0.2 + strength * (0.25 + Math.random() * 0.65);
    this.sizes[i] = isFoam
      ? 0.12 + strength * (0.16 + Math.random() * 0.22)
      : 0.045 + strength * (0.07 + Math.random() * 0.14) + impact * 0.018;
    this.positions[j] = r.x - fx * (isFoam ? 1.8 : 0.4) + fz * side * (0.65 + Math.random() * 0.35);
    this.positions[j + 1] = r.y - 0.15;
    this.positions[j + 2] =
      r.z - fz * (isFoam ? 1.8 : 0.4) - fx * side * (0.65 + Math.random() * 0.35);
    const lateral =
      side *
      (0.2 + pace * (1.8 + Math.random() * 3) + Math.abs(r.steer) * speed * 0.18 + impact * 0.5);
    this.velocities[j] = r.vx * 0.13 + fz * lateral - fx * 2 * pace;
    this.velocities[j + 1] = isFoam
      ? 0
      : 0.15 + pace * (1.35 + Math.random() * 2.5) + speed * 0.035 + impact * 0.4;
    this.velocities[j + 2] = r.vz * 0.13 - fx * lateral - fz * 2 * pace;
    this.object.setColorAt(i, Math.random() > 0.23 ? this.white : this.blue);
  }
  update(dt: number, racers: Racer[], track: Track, time: number, water: WaterProfile = track) {
    for (const r of racers) {
      const speed = Math.hypot(r.vx, r.vz),
        cooldown = Math.max(0, (this.cooldown.get(r.id) ?? 0) - dt);
      this.cooldown.set(r.id, cooldown);
      if (
        (this.lastWet.get(r.id) ?? 1) === 0 &&
        r.wet > 0 &&
        cooldown === 0 &&
        (this.lastVy.get(r.id) ?? 0) < -1.5
      ) {
        const impact = Math.min(12, Math.max(0, -(this.lastVy.get(r.id) ?? 0)));
        for (let n = 0; n < 30 + impact * 7; n++) this.emit(r, n % 2 ? 1 : -1, impact, n % 4 === 0);
        this.cooldown.set(r.id, 0.2);
      }
      if (r.wet > 0 && !r.onRamp && r.recovery.phase === 'riding' && speed > 0.5) {
        let count =
          (this.emission.get(r.id) ?? 0) +
          dt *
            310 *
            (1 + Math.abs(r.steer) * 0.7) *
            Math.pow(Math.min(speed / 22, 1), 1.6) *
            r.wet *
            (r.id === 0 ? 1 : 0.6);
        while (count >= 1) {
          this.emit(r, Math.random() < 0.5 + r.steer * 0.3 ? -1 : 1, 0, Math.random() < 0.38);
          count--;
        }
        this.emission.set(r.id, count);
      }
      this.lastWet.set(r.id, r.wet);
      this.lastVy.set(r.id, r.vy);
    }
    this.activeCount = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) {
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.object.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      this.activeCount++;
      if (this.foam[i]) {
        this.positions[j] += this.velocities[j] * dt * 0.3;
        this.positions[j + 2] += this.velocities[j + 2] * dt * 0.3;
        this.positions[j + 1] =
          waterHeight(this.positions[j], this.positions[j + 2], time, water) + 0.06;
      } else {
        this.velocities[j + 1] -= 9.81 * dt;
        for (let k = 0; k < 3; k++) this.positions[j + k] += this.velocities[j + k] * dt;
        const surface = waterHeight(this.positions[j], this.positions[j + 2], time, water);
        if (this.positions[j + 1] < surface && this.velocities[j + 1] < 0) {
          this.foam[i] = 1;
          this.sizes[i] *= 1.15;
          this.life[i] = Math.min(this.life[i], 0.45);
        }
      }
      const fade = Math.min(1, this.life[i] * 4),
        size = this.sizes[i] * fade;
      this.dummy.position.fromArray(this.positions, j);
      this.dummy.rotation.set(
        this.foam[i] ? 0 : time + i,
        this.foam[i] ? i : time * 0.7,
        this.foam[i] ? 0 : time * 0.5,
      );
      this.dummy.scale.set(size, this.foam[i] ? 0.035 : size, size * (this.foam[i] ? 1.5 : 1));
      this.dummy.updateMatrix();
      this.object.setMatrixAt(i, this.dummy.matrix);
    }
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) this.object.instanceColor.needsUpdate = true;
  }
}
