import * as T from 'three';
import { loft } from './modeling';
import type { Racer } from './physics';

/** A compact energy plume mounted in the same frame as the stern nozzle. */
export class JetExhaust {
  readonly group = new T.Group();
  private core: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private shell: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private amount = 0;
  private contact = 1;
  private phase = 0;
  constructor() {
    this.group.name = 'jet-exhaust';
    this.group.position.set(0, -0.13, -2.128 * 0.87);
    const geometry = loft(
      [
        { at: -1, width: 0.003, depth: 0.003 },
        { at: -0.7, width: 0.1, depth: 0.1 },
        { at: -0.2, width: 0.17, depth: 0.17 },
        { at: 0, width: 0.1, depth: 0.1 },
      ],
      8,
      'z',
    );
    const shellMaterial = new T.MeshBasicMaterial({
      color: new T.Color(0.15, 1.6, 2.5),
      transparent: true,
      opacity: 0.4,
      blending: T.AdditiveBlending,
      depthWrite: false,
    });
    this.shell = new T.Mesh(geometry, shellMaterial);
    this.core = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        color: new T.Color(1.5, 2.5, 3),
        transparent: true,
        opacity: 0.8,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.core.scale.set(0.5, 0.5, 0.7);
    this.group.add(this.shell, this.core);
    this.group.visible = false;
  }
  update(racer: Racer, dt: number, throttle = Math.min(Math.hypot(racer.vx, racer.vz) / 8, 1)) {
    const speed = Math.min(Math.hypot(racer.vx, racer.vz) / 30, 1);
    const supported = racer.wet > 0 || racer.onRamp;
    this.contact += ((supported ? 1 : 0) - this.contact) * (1 - Math.exp(-dt * 12));
    const boost = racer.boost > 0 ? Math.min(racer.boostPower - 1, 1.8) * this.contact : 0;
    const driving = racer.recovery.phase === 'riding';
    const target = driving
      ? Math.max(0, Math.min(1, throttle)) * (0.2 + speed * 0.8) * (0.12 + this.contact * 0.88)
      : 0;
    this.amount += (target - this.amount) * (1 - Math.exp(-dt * 14));
    this.phase += dt * (18 + speed * 18);
    this.group.visible = this.amount > 0.015;
    const pulse = 1 + Math.sin(this.phase) * 0.055 + Math.sin(this.phase * 2.7) * 0.025;
    const width = (0.5 + this.amount * 0.5 + boost * 0.2) * pulse * (0.4 + this.contact * 0.6);
    this.group.scale.set(width, width, this.amount * (1.8 + boost * 1.2) * pulse);
    this.shell.material.opacity =
      (0.28 + this.amount * 0.15 + boost * 0.08) * (0.2 + this.contact * 0.8);
    this.core.material.opacity = 0.8 * (0.25 + this.contact * 0.75);
    this.shell.material.color.setRGB(boost > 1 ? 0.65 : 0.15, 1.6, 2.5 + boost * 0.4);
  }
}
