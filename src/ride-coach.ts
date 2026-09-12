import type { Snapshot } from './game/engine';
import type { Input } from './game/physics';

type Device = 'keyboard' | 'gamepad' | 'touch';
const ACCELERATE = 1,
  GATES = 2,
  BRAKE = 4,
  JUMP = 8;
const STORAGE = 'vectide:driving-tips:v1';
const bindings = {
  keyboard: ['W / ↑', 'A D / ← →', 'S / SPACE', 'HOLD E'],
  gamepad: ['RT', 'LEFT STICK', 'LT', 'HOLD RB'],
  touch: ['AUTO THROTTLE', 'SLIDE STICK', 'BRAKE', 'HOLD JUMP'],
};

/** Tips follow successful actions, and are remembered separately for each input device. */
export class RideCoach {
  private progress: Partial<Record<Device, number>> = {};
  private key: HTMLElement;
  private text: HTMLElement;
  constructor(private element: HTMLElement) {
    this.key = element.querySelector('.coach-key')!;
    this.text = element.querySelector('.coach-text')!;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? '{}');
      for (const device of ['keyboard', 'gamepad', 'touch'] as const) {
        const value = saved?.[device];
        if (Number.isInteger(value) && value >= 0 && value <= 15) this.progress[device] = value;
      }
    } catch {
      /* A private or storage-limited browser still gets session-local tips. */
    }
    element.querySelector<HTMLButtonElement>('button')!.onclick = () => {
      this.save(this.device, 15);
      element.hidden = true;
    };
  }
  private get device(): Device {
    return document.body.dataset.input === 'touch'
      ? 'touch'
      : document.body.dataset.input === 'gamepad'
        ? 'gamepad'
        : 'keyboard';
  }
  private save(device: Device, value: number) {
    if (this.progress[device] === value) return;
    this.progress[device] = value;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(this.progress));
    } catch {
      /* Keep session progress. */
    }
  }
  update(s: Snapshot, input: Input) {
    const device = this.device,
      p = s.player;
    let progress = this.progress[device] ?? 0;
    if (s.state === 'finished') this.save(device, progress | ACCELERATE | GATES | BRAKE);
    if (
      !['countdown', 'racing'].includes(s.state) ||
      s.track.practiceRadius ||
      s.missed ||
      p.recovery.phase !== 'riding'
    ) {
      this.element.hidden = true;
      return;
    }
    if (s.state === 'racing') {
      if (input.throttle > 0 && s.speed > 12) progress |= ACCELERATE;
      if (p.passed >= 2 && Math.abs(p.steer) > 0.12) progress |= GATES;
      if (input.brake > 0.2 && s.speed > 4) progress |= BRAKE;
      if (p.air.message.includes('LANDED')) progress |= JUMP;
      this.save(device, progress);
    }
    let step = -1;
    if (!(progress & ACCELERATE)) step = 0;
    else if (!(progress & GATES)) step = 1;
    else if (!(progress & BRAKE)) step = 2;
    else if (
      !(progress & JUMP) &&
      s.track.ramps.some((r) => {
        const dx = r.x - p.x,
          dz = r.z - p.z;
        return Math.hypot(dx, dz) < 45 && dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw) > -5;
      })
    )
      step = 3;
    this.element.hidden = step < 0;
    if (step < 0) return;
    this.key.textContent = bindings[device][step];
    this.text.textContent = [
      device === 'touch' ? 'Slide the stick to steer' : 'Hold to accelerate',
      'Steer between both glowing buoys',
      'Brake before a tight turn',
      'Optional jump: release at takeoff',
    ][step];
  }
}
