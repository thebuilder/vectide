import { Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import type { Gate } from './game/tracks';
import { CHECKPOINT_POST_REACH, CHECKPOINT_POST_DEPTH } from './game/checkpoint-model';
import type { Engine } from './game/engine';

export interface GuideBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class CheckpointGuide {
  private direction: HTMLElement;
  state: (ReturnType<typeof projectCheckpoint> & { inView: boolean }) | undefined;

  constructor(private element: HTMLElement) {
    this.direction = element.querySelector('#direction')!;
  }

  render(engine: Engine) {
    const shown = ['countdown', 'racing'].includes(engine.state) && !engine.track.practiceRadius;
    this.element.hidden = !shown || (engine.player.nextGate === 0 && engine.player.passed === 0);
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
    const inView = checkpointInView(
      engine.track.gates[engine.player.nextGate],
      engine.checkpointTarget,
      engine.camera,
    );
    this.element.hidden ||= inView;
    this.state = { ...guide, inView };
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

const viewFrustum = new Frustum();
const viewProjection = new Matrix4();
const gateCenter = new Vector3();
const nearCorner = new Vector3();
const gateCorners = Array.from({ length: 8 }, () => new Vector3());
// A quad clipped by six planes has at most ten vertices. Reuse both buffers per frame.
const clipA = Array.from({ length: 12 }, () => new Vector3());
const clipB = Array.from({ length: 12 }, () => new Vector3());
const gateFaces = [
  [0, 1, 3, 2],
  [4, 6, 7, 5],
  [0, 2, 6, 4],
  [1, 5, 7, 3],
  [0, 4, 5, 1],
  [2, 3, 7, 6],
];

/** Clip the opening and posts themselves, including side-on and pitched camera views. */
export function checkpointInView(gate: Gate, target: Vector3, camera: PerspectiveCamera) {
  const halfWidth = gate.width / 2 + CHECKPOINT_POST_REACH;
  gateCenter.set(target.x, target.y - 1.5, target.z);
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  viewFrustum.setFromProjectionMatrix(viewProjection);
  for (let i = 0; i < 8; i++) {
    const side = (i & 1 ? 1 : -1) * halfWidth;
    const up = (i & 2 ? 1 : -1) * 5;
    const depth = (i & 4 ? 1 : -1) * CHECKPOINT_POST_DEPTH;
    gateCorners[i].set(
      gateCenter.x - gate.tz * side + gate.tx * depth,
      gateCenter.y + up,
      gateCenter.z + gate.tx * side + gate.tz * depth,
    );
  }
  for (const face of gateFaces) {
    let input = clipA,
      output = clipB,
      count = 4;
    for (let i = 0; i < count; i++) input[i].copy(gateCorners[face[i]]);
    for (const plane of viewFrustum.planes) {
      let written = 0;
      let previous = input[count - 1];
      let previousDistance = plane.distanceToPoint(previous);
      for (let i = 0; i < count; i++) {
        const point = input[i];
        const distance = plane.distanceToPoint(point);
        if (distance >= 0 !== previousDistance >= 0) {
          output[written++]
            .copy(previous)
            .lerp(point, previousDistance / (previousDistance - distance));
        }
        if (distance >= 0) output[written++].copy(point);
        previous = point;
        previousDistance = distance;
      }
      count = written;
      if (!count) break;
      const swap = input;
      input = output;
      output = swap;
    }
    if (count) return true;
  }
  // Handle the remaining containment case: the entire view lies inside the gate volume.
  nearCorner.set(-1, -1, -1).unproject(camera).sub(gateCenter);
  return (
    Math.abs(-gate.tz * nearCorner.x + gate.tx * nearCorner.z) <= halfWidth &&
    Math.abs(nearCorner.y) <= 5 &&
    Math.abs(gate.tx * nearCorner.x + gate.tz * nearCorner.z) <= CHECKPOINT_POST_DEPTH
  );
}
