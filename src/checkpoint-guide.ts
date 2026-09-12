import { PerspectiveCamera, Vector3 } from 'three';
import type { Engine } from './game/engine';

export interface GuideBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class CheckpointGuide {
  private direction: HTMLElement;
  state: ReturnType<typeof projectCheckpoint> | undefined;

  constructor(private element: HTMLElement) {
    this.direction = element.querySelector('#direction')!;
  }

  render(engine: Engine) {
    const shown = ['countdown', 'racing'].includes(engine.state) && !engine.track.practiceRadius;
    this.element.hidden = !shown || engine.player.nextGate === 0;
    if (!shown) return;
    const width = innerWidth,
      height = innerHeight;
    const touch = document.body.dataset.input === 'touch';
    const top = height < 500 ? 90 : width < 700 ? 205 : 120;
    const bounds = {
      left: 84,
      right: width - 84,
      top: Math.min(top, height * 0.4),
      bottom: Math.max(top + 20, height - (touch ? (height < 500 ? 245 : 200) : 90)),
    };
    const guide = projectCheckpoint(engine.checkpointTarget, engine.camera, width, height, bounds);
    this.state = guide;
    this.element.style.left = `${guide.x}px`;
    this.element.style.top = `${guide.y}px`;
    this.element.dataset.outside = String(guide.outside);
    this.direction.style.transform = `rotate(${guide.angle}rad)`;
    const bearing = guide.behind
      ? 'TURN BACK'
      : guide.outside
        ? guide.x < bounds.left + 1
          ? 'TURN LEFT'
          : guide.x > bounds.right - 1
            ? 'TURN RIGHT'
            : 'AHEAD'
        : 'NEXT GATE';
    this.element.setAttribute('aria-label', `${bearing}, gate ${engine.player.nextGate + 1}`);
  }
}

/** Clip the camera's target ray to the usable HUD area, including targets behind it. */
export function projectCheckpoint(
  target: Vector3,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  bounds: GuideBounds,
) {
  const local = target.clone().applyMatrix4(camera.matrixWorldInverse);
  const behind = local.z >= -0.1;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const projected = target.clone().project(camera);
  // A target behind the rider belongs at a side edge, never mirrored ahead of them.
  const x = behind ? centerX + (local.x < 0 ? -width : width) : (projected.x + 1) * width * 0.5;
  const y = behind ? centerY : (1 - projected.y) * height * 0.5;
  const outside =
    behind || x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  const dx = x - centerX;
  const dy = y - centerY;
  const scale = outside
    ? Math.min(
        (bounds.right - bounds.left) / 2 / Math.max(Math.abs(dx), 0.001),
        (bounds.bottom - bounds.top) / 2 / Math.max(Math.abs(dy), 0.001),
      )
    : 1;
  return {
    x: outside ? centerX + dx * scale : x,
    y: outside ? centerY + dy * scale : y,
    angle: outside ? Math.atan2(dy, dx) + Math.PI / 2 : Math.PI,
    outside,
    behind,
  };
}
