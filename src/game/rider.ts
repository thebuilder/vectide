import * as T from 'three';
import { loft, panel } from './modeling';
import {
  createRiderPose,
  solveJoint,
  stepRiderPose,
  fitRootToContacts,
  boneOrientation,
  type RiderPose,
} from './rider-pose';
import type { Racer } from './physics';

interface Limb {
  upper: T.Mesh;
  lower: T.Mesh;
  joint: T.Mesh;
  contact: T.Group;
}
export interface RiderRig {
  root: T.Group;
  body: T.Group;
  head: T.Group;
  legs: Limb[];
  arms: Limb[];
  pose: RiderPose;
  update: (r: Racer, dt: number, grips: T.Vector3[], deckFeet?: T.Vector3[]) => void;
}
function material(color: T.ColorRepresentation, roughness = 0.6, metalness = 0.05) {
  return new T.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
function segment(parent: T.Group, length: number, width: number, mat: T.Material): T.Mesh {
  const geometry = loft(
    [
      { at: 0, width: width * 0.8, depth: width * 0.8 },
      { at: length * 0.2, width, depth: width * 0.9 },
      { at: length * 0.6, width: width * 0.86, depth: width * 0.77 },
      { at: length, width: width * 0.59, depth: width * 0.63 },
    ],
    8,
  );
  const mesh = new T.Mesh(geometry, mat);
  parent.add(mesh);
  return mesh;
}
function placeBone(mesh: T.Mesh, a: T.Vector3, b: T.Vector3) {
  mesh.position.copy(a);
  mesh.quaternion.copy(boneOrientation(a, b));
}
function curvedVisor(): T.BufferGeometry {
  const v: number[] = [],
    indices: number[] = [];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i <= 12; i++) {
      const a = -1.42 + (i / 12) * 2.84;
      v.push(Math.sin(a) * 0.269, -0.01 + row * 0.145, Math.cos(a) * 0.269 + 0.012);
    }
  for (let i = 0; i < 12; i++) indices.push(i, i + 1, i + 13, i + 1, i + 14, i + 13);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function raceBadge(color: string, number: number): T.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = '#091825';
  ctx.font = '900 92px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(String(number).padStart(2, '0'), 64, 105);
  ctx.fillStyle = '#f3ead7';
  ctx.fillRect(14, 121, 100, 3);
  ctx.font = 'bold 13px monospace';
  ctx.fillText('VECTIDE', 64, 144);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(0.35, 0.43),
    new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
}
export function createRider(color: string, number: number): RiderRig {
  const root = new T.Group();
  root.name = 'rider';
  const suit = material('#142435'),
    trim = material(color, 0.45),
    ivory = material('#e5e6d9'),
    skin = material('#b97850', 0.78),
    rubber = material('#091318', 0.95),
    visor = material('#123c56', 0.14, 0.75);
  const body = new T.Group();
  body.name = 'rider-torso';
  root.add(body);
  const pelvis = new T.Mesh(
    loft(
      [
        { at: -0.06, width: 0.19, depth: 0.16 },
        { at: 0.06, width: 0.225, depth: 0.175 },
        { at: 0.15, width: 0.195, depth: 0.145 },
      ],
      10,
    ),
    suit,
  );
  body.add(pelvis);
  const torso = new T.Mesh(
    loft(
      [
        { at: 0.09, width: 0.2, depth: 0.15 },
        { at: 0.21, width: 0.23, depth: 0.18 },
        { at: 0.47, width: 0.295, depth: 0.19 },
        { at: 0.57, width: 0.28, depth: 0.145 },
        { at: 0.63, width: 0.11, depth: 0.1 },
      ],
      10,
    ),
    ivory,
  );
  body.add(torso);
  // Separate padded vest panels, contrasting side seams and a visible racing number.
  for (const side of [-1, 1]) {
    panel(body, [0.1, 0.42, 0.3], [side * 0.23, 0.35, 0], suit);
    panel(body, [0.19, 0.17, 0.065], [side * 0.115, 0.36, 0.18], trim);
    panel(body, [0.2, 0.1, 0.06], [side * 0.115, 0.2, 0.16], trim);
    panel(body, [0.08, 0.29, 0.035], [side * 0.17, 0.43, -0.165], suit);
    const shoulder = panel(body, [0.14, 0.07, 0.28], [side * 0.225, 0.565, 0], trim);
    shoulder.rotation.z = -side * 0.12;
  }
  panel(body, [0.39, 0.07, 0.34], [0, 0.13, 0], rubber);
  panel(body, [0.025, 0.44, 0.025], [0, 0.37, 0.2], rubber, 0.005);
  const badge = raceBadge(color, number);
  badge.rotation.y = Math.PI;
  badge.position.set(0, 0.365, -0.191);
  body.add(badge);
  const neck = new T.Mesh(new T.CylinderGeometry(0.085, 0.1, 0.14, 8), rubber);
  neck.position.y = 0.66;
  body.add(neck);
  const head = new T.Group();
  head.name = 'rider-head';
  head.position.set(0, 0.85, 0.035);
  body.add(head);
  const shell = new T.Mesh(
    loft(
      [
        { at: -0.22, width: 0.16, depth: 0.19 },
        { at: -0.12, width: 0.24, depth: 0.25 },
        { at: 0.05, width: 0.27, depth: 0.27 },
        { at: 0.18, width: 0.23, depth: 0.23 },
        { at: 0.27, width: 0.12, depth: 0.13 },
        { at: 0.3, width: 0.025, depth: 0.035 },
      ],
      14,
    ),
    ivory,
  );
  head.add(shell);
  const glass = new T.Mesh(curvedVisor(), visor);
  head.add(glass);
  const chin = panel(head, [0.35, 0.11, 0.21], [0, -0.16, 0.22], trim, 0.035);
  chin.rotation.x = -0.2;
  panel(head, [0.13, 0.07, 0.025], [0, -0.155, 0.335], rubber, 0.012);
  const stripe = new T.Mesh(
    loft(
      [
        { at: 0.2, width: 0.047, depth: 0.2 },
        { at: 0.272, width: 0.047, depth: 0.105 },
        { at: 0.305, width: 0.04, depth: 0.02 },
      ],
      6,
    ),
    trim,
  );
  head.add(stripe);
  for (const side of [-1, 1]) {
    panel(head, [0.032, 0.11, 0.18], [side * 0.245, -0.07, -0.08], trim, 0.008);
    panel(head, [0.085, 0.025, 0.02], [side * 0.1, -0.12, -0.24], rubber, 0.004);
  }
  panel(head, [0.055, 0.19, 0.022], [0, 0.04, -0.269], trim, 0.006);
  const legs: Limb[] = [],
    arms: Limb[] = [];
  for (const side of [-1, 1]) {
    const upper = segment(root, 0.55, 0.145, suit),
      lower = segment(root, 0.53, 0.108, suit);
    // Color blocks follow the bones, so they remain attached during deep compression.
    panel(upper, [0.04, 0.28, 0.15], [side * 0.13, 0.24, 0], trim, 0.015);
    panel(lower, [0.11, 0.19, 0.055], [0, 0.16, 0.082], ivory, 0.025);
    const joint = new T.Mesh(new T.IcosahedronGeometry(0.117, 1), rubber);
    root.add(joint);
    panel(joint, [0.145, 0.13, 0.07], [0, 0, 0.075], trim, 0.025);
    const boot = new T.Group();
    boot.name = side < 0 ? 'left-foot' : 'right-foot';
    root.add(boot);
    panel(boot, [0.19, 0.11, 0.4], [0, -0.04, 0.06], rubber, 0.025);
    panel(boot, [0.18, 0.15, 0.28], [0, 0.035, 0.055], ivory, 0.035);
    panel(boot, [0.195, 0.045, 0.16], [0, 0.07, 0.075], trim, 0.015);
    legs.push({ upper, lower, joint, contact: boot });
    const upperArm = segment(root, 0.405, 0.092, skin),
      forearm = segment(root, 0.405, 0.073, skin);
    panel(upperArm, [0.16, 0.14, 0.16], [0, 0.075, 0], suit, 0.035);
    panel(forearm, [0.115, 0.11, 0.105], [0, 0.345, 0], trim, 0.02);
    const elbow = new T.Mesh(new T.IcosahedronGeometry(0.075, 1), skin);
    root.add(elbow);
    const glove = new T.Group();
    glove.name = side < 0 ? 'left-hand' : 'right-hand';
    root.add(glove);
    panel(glove, [0.145, 0.12, 0.17], [0, 0, 0.015], rubber, 0.035);
    panel(glove, [0.12, 0.035, 0.12], [0, 0.06, 0.015], ivory, 0.012);
    arms.push({ upper: upperArm, lower: forearm, joint: elbow, contact: glove });
  }
  const pose = createRiderPose();
  const rig: RiderRig = {
    root,
    body,
    head,
    legs,
    arms,
    pose,
    update(r, dt, grips, deckFeet) {
      stepRiderPose(pose, r, dt);
      body.position.set(
        pose.lean,
        1.12 - pose.compression,
        -0.27 - Math.max(0, pose.forward - 0.12) * 0.12 - r.lean * 0.12,
      );
      body.rotation.set(pose.forward, r.steer * 0.12, -pose.lean * 0.9 - r.roll * 0.2);
      const recovery = r.recovery;
      const detached = recovery.phase !== 'riding';
      const mount =
        recovery.phase === 'remounting' ? T.MathUtils.smoothstep(recovery.elapsed / 1.35, 0, 1) : 0;
      if (detached) {
        const falling = recovery.phase === 'falling';
        const settle = falling ? T.MathUtils.smoothstep(recovery.elapsed, 0, 0.7) : 1;
        body.position.set(
          0,
          T.MathUtils.lerp(1.02, 0.16, settle) * (1 - mount) + (1.12 - pose.compression) * mount,
          -0.15 * mount,
        );
        body.rotation.set(
          1.1 * settle * (1 - mount) + pose.forward * mount,
          0,
          falling ? Math.sin(recovery.elapsed * 7) * 0.25 : 0,
        );
      }
      const footTarget = (side: number) => {
        const extension = Math.max(0, r.body.foot * side);
        const riding = new T.Vector3(
          side * (0.51 + extension * 0.32),
          0.24 - extension * 0.56,
          -0.7 + extension * 0.12,
        );
        if (!detached) return riding;
        const swim = new T.Vector3(
          side * 0.28,
          -0.15 + Math.sin(recovery.elapsed * 8 + side) * 0.12,
          -0.85,
        );
        return swim.lerp(deckFeet?.[side < 0 ? 0 : 1] ?? riding, mount);
      };
      const handTarget = (i: number) => {
        if (!detached) return grips[i];
        const side = i === 0 ? -1 : 1;
        const swim = new T.Vector3(
          side * (0.48 + Math.sin(recovery.elapsed * 5 + side) * 0.08),
          0.14,
          0.65,
        );
        return swim.lerp(grips[i], recovery.phase === 'remounting' ? Math.min(1, mount * 2.5) : 0);
      };
      fitRootToContacts(
        body.position,
        [-1, 1].flatMap((side, i) => [
          {
            offset: new T.Vector3(side * 0.17, 0, 0).applyEuler(body.rotation),
            target: footTarget(side),
            reach: 1.08 - 0.003,
          },
          {
            offset: new T.Vector3(side * 0.29, 0.535, 0).applyEuler(body.rotation),
            target: handTarget(i),
            reach: 0.81 - 0.003,
          },
        ]),
      );
      body.updateMatrix();
      head.rotation.set(-pose.forward * 0.35, 0, -body.rotation.z * 0.35);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1,
          leg = legs[i],
          arm = arms[i];
        const hip = new T.Vector3(side * 0.17, 0, 0).applyMatrix4(body.matrix),
          foot = footTarget(side);
        const knee = solveJoint(hip, foot, 0.55, 0.53, new T.Vector3(side * 0.65, 0.55, 0.12));
        placeBone(leg.upper, hip, knee);
        placeBone(leg.lower, knee, foot);
        leg.joint.position.copy(knee);
        leg.contact.position.copy(foot);
        const shoulder = new T.Vector3(side * 0.29, 0.535, 0).applyMatrix4(body.matrix),
          hand = handTarget(i);
        const elbow = solveJoint(
          shoulder,
          hand,
          0.405,
          0.405,
          new T.Vector3(side * 0.9, 1.1, -0.22),
        );
        placeBone(arm.upper, shoulder, elbow);
        placeBone(arm.lower, elbow, hand);
        arm.joint.position.copy(elbow);
        arm.contact.position.copy(hand);
        arm.contact.rotation.y = r.steer * 0.24;
      }
    },
  };
  return rig;
}
