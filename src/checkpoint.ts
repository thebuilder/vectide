import { Vector3, type Camera } from 'three';
import type { Engine } from './game/engine';

const local = new Vector3();
const projected = new Vector3();
const target = new Vector3();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Keep the target in the driving view, including when the camera faces away from it. */
export function checkpointPosition(camera: Camera, point: Vector3, width: number, height: number) {
  local.copy(point).applyMatrix4(camera.matrixWorldInverse);
  const left = 78,
    right = width - 78;
  const top = Math.min(225, height * 0.55),
    bottom = height * 0.64;
  if (local.z >= -0.1) {
    const side = local.x < 0 ? -1 : 1;
    return {
      x: side < 0 ? left : right,
      y: Math.max(top, height * 0.4),
      angle: (side * Math.PI) / 2,
      offscreen: true,
    };
  }
  projected.copy(point).project(camera);
  const px = ((projected.x + 1) * width) / 2;
  const py = ((1 - projected.y) * height) / 2 - 30;
  const x = clamp(px, left, right),
    y = clamp(py, top, bottom);
  const offscreen = x !== px || y !== py;
  return { x, y, offscreen, angle: offscreen ? Math.atan2(px - x, y - py) : Math.PI };
}

export function setupCheckpoint(element: HTMLElement, engine: Engine) {
  const arrow = element.querySelector<HTMLElement>('#direction')!;
  const number = element.querySelector<HTMLElement>('#gate')!;
  const distance = element.querySelector<HTMLElement>('#distance')!;
  return () => {
    const player = engine.player;
    element.hidden =
      !['countdown', 'racing', 'paused'].includes(engine.state) ||
      !!engine.track.practiceRadius ||
      player.finished;
    if (element.hidden) return;
    const gate = engine.track.gates[player.nextGate];
    target.set(gate.x, 6, gate.z);
    const position = checkpointPosition(engine.camera, target, innerWidth, innerHeight);
    element.style.translate = `${position.x}px ${position.y}px`;
    element.dataset.offscreen = String(position.offscreen);
    arrow.style.rotate = `${position.angle}rad`;
    number.textContent = String(player.nextGate + 1).padStart(2, '0');
    distance.textContent = `${Math.round(Math.hypot(gate.x - player.x, gate.z - player.z))} M`;
  };
}
