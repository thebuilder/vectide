import * as T from 'three';
import { loft, panel, rod } from './modeling';
import { createRider, type RiderRig } from './rider';
import { batchStatic } from './batch';
import type { Racer } from './physics';

interface JetRig {
  rider: RiderRig;
  handlebars: T.Group;
}
const rigs = new WeakMap<T.Group, JetRig>();
function paint(color: T.ColorRepresentation, metalness = 0.15, roughness = 0.38) {
  return new T.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
export function createJet(color: string, number = 1): T.Group {
  const jet = new T.Group();
  const ivory = paint('#e4e6df'),
    accent = paint(color, 0.28),
    navy = paint('#142332'),
    rubber = paint('#071317', 0, 0.88),
    metal = paint('#8b9ba5', 0.8, 0.27);
  const hull = new T.Mesh(
    loft(
      [
        { at: -1.9, width: 0.58, depth: 0.24, shift: -0.06 },
        { at: -1.55, width: 0.73, depth: 0.34, shift: -0.06 },
        { at: -0.55, width: 0.79, depth: 0.39, shift: -0.08 },
        { at: 0.65, width: 0.64, depth: 0.34, shift: 0.02 },
        { at: 1.5, width: 0.4, depth: 0.23, shift: 0.2 },
        { at: 2.13, width: 0.035, depth: 0.07, shift: 0.34 },
      ],
      12,
      'z',
    ),
    ivory,
  );
  jet.add(hull);
  const keel = new T.Mesh(
    loft(
      [
        { at: -1.85, width: 0.49, depth: 0.12, shift: -0.29 },
        { at: -0.7, width: 0.68, depth: 0.16, shift: -0.34 },
        { at: 0.9, width: 0.45, depth: 0.12, shift: -0.16 },
        { at: 1.85, width: 0.035, depth: 0.03, shift: 0.2 },
      ],
      10,
      'z',
    ),
    navy,
  );
  jet.add(keel);
  const pod = new T.Mesh(
    loft(
      [
        { at: -0.15, width: 0.31, depth: 0.14, shift: 0.36 },
        { at: 0.25, width: 0.42, depth: 0.23, shift: 0.4 },
        { at: 0.85, width: 0.4, depth: 0.24, shift: 0.46 },
        { at: 1.55, width: 0.24, depth: 0.15, shift: 0.46 },
        { at: 1.96, width: 0.025, depth: 0.035, shift: 0.38 },
      ],
      10,
      'z',
    ),
    accent,
  );
  jet.add(pod);
  const seat = new T.Mesh(
    loft(
      [
        { at: -1.48, width: 0.23, depth: 0.1, shift: 0.39 },
        { at: -0.95, width: 0.28, depth: 0.12, shift: 0.44 },
        { at: -0.35, width: 0.25, depth: 0.12, shift: 0.49 },
        { at: 0.1, width: 0.19, depth: 0.09, shift: 0.54 },
      ],
      10,
      'z',
    ),
    rubber,
  );
  jet.add(seat);
  panel(jet, [0.44, 0.23, 1.35], [0, 0.28, -0.72], navy, 0.04);
  for (const side of [-1, 1]) {
    // Footwell moulding joins the grip pad to the curved hull.
    panel(jet, [0.31, 0.24, 1.48], [side * 0.5, 0.105, -0.74], ivory, 0.035);
    panel(jet, [0.29, 0.065, 1.48], [side * 0.5, 0.22, -0.74], rubber, 0.025);
    for (let n = 0; n < 8; n++)
      panel(jet, [0.24, 0.018, 0.025], [side * 0.5, 0.262, -1.35 + n * 0.17], metal, 0.005);
    const vent = panel(jet, [0.035, 0.12, 0.46], [side * 0.395, 0.46, 0.67], navy, 0.025);
    vent.rotation.z = -side * 0.2;
    for (let n = 0; n < 4; n++)
      panel(jet, [0.04, 0.08, 0.025], [side * 0.415, 0.46, 0.5 + n * 0.1], metal, 0.003);
  }
  panel(jet, [0.32, 0.025, 0.74], [0, 0.676, 0.86], navy, 0.015);
  panel(jet, [0.1, 0.035, 0.62], [0, 0.7, 0.87], ivory, 0.01);
  // A solid transom and pump flange visibly join the outlet to the hull.
  panel(jet, [0.94, 0.38, 0.22], [0, -0.04, -1.82], ivory, 0.035);
  const flange = new T.Mesh(new T.CylinderGeometry(0.24, 0.24, 0.18, 12), navy);
  flange.rotation.x = Math.PI / 2;
  flange.position.set(0, -0.13, -1.91);
  jet.add(flange);
  const nozzle = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.25, 12), metal);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, -0.13, -2.0);
  jet.add(nozzle);
  const hole = new T.Mesh(new T.CircleGeometry(0.13, 12), rubber);
  hole.rotation.y = Math.PI;
  hole.position.set(0, -0.13, -2.128);
  jet.add(hole);
  panel(jet, [0.52, 0.12, 0.2], [0, 0.12, -1.87], navy, 0.02);
  const tailLight = new T.MeshStandardMaterial({
    color: 0xff4966,
    emissive: 0xff264a,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  panel(jet, [0.3, 0.035, 0.015], [0, 0.13, -1.975], tailLight, 0.004);
  const handlebars = new T.Group();
  handlebars.name = 'handlebars';
  handlebars.position.set(0, 1.24, 0.28);
  jet.add(handlebars);

  rod(handlebars, new T.Vector3(-0.53, 0, 0), new T.Vector3(0.53, 0, 0), 0.032, metal);
  for (const side of [-1, 1]) {
    rod(
      handlebars,
      new T.Vector3(side * 0.42, 0, 0),
      new T.Vector3(side * 0.61, 0, 0),
      0.048,
      rubber,
    );
    rod(
      handlebars,
      new T.Vector3(side * 0.42, -0.055, 0.04),
      new T.Vector3(side * 0.57, -0.055, 0.07),
      0.015,
      metal,
    );
  }
  panel(handlebars, [0.2, 0.09, 0.13], [0, -0.01, 0], navy, 0.025);
  const display = panel(
    jet,
    [0.19, 0.015, 0.18],
    [0, 0.75, 0.61],
    new T.MeshStandardMaterial({ color: 0x86fadd, emissive: 0x86fadd, emissiveIntensity: 0.25 }),
    0.008,
  );
  display.rotation.x = 0.3;
  // Scale bodywork in one shared frame, including rotated fittings.
  const bodywork = new T.Group();
  bodywork.name = 'bodywork';
  for (const part of [...jet.children]) if (part !== handlebars) bodywork.add(part);
  bodywork.scale.set(0.82, 1, 0.87);
  jet.add(bodywork);
  rod(jet, new T.Vector3(0, 0.61, 0.88 * 0.87), new T.Vector3(0, 1.24, 0.28), 0.045, metal);

  batchStatic(jet, [handlebars]);
  const rider = createRider(color, number);
  jet.add(rider.root);
  rigs.set(jet, { rider, handlebars });
  return jet;
}
export function animateJet(jet: T.Group, r: Racer, dt: number): void {
  const rig = rigs.get(jet);
  if (!rig) return;
  rig.handlebars.rotation.y = r.steer * 0.24;
  rig.handlebars.updateMatrix();
  const grips = [-1, 1].map((side) =>
    new T.Vector3(side * 0.52, 0, 0).applyMatrix4(rig.handlebars.matrix),
  );
  rig.rider.update(r, dt, grips);
}

/** Copy of contact errors and pose values for the existing read-only runtime diagnostics. */
export function inspectJet(jet: T.Group) {
  const rig = rigs.get(jet);
  if (!rig) return null;
  const tip = (mesh: T.Mesh, length: number) =>
    new T.Vector3(0, length, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
  return {
    compression: rig.rider.pose.compression,
    forward: rig.rider.pose.forward,
    lean: rig.rider.pose.lean,
    pelvis: rig.rider.body.position.toArray(),
    knees: rig.rider.legs.map((leg) => leg.joint.position.toArray()),
    footErrors: rig.rider.legs.map((leg) => tip(leg.lower, 0.53).distanceTo(leg.contact.position)),
    handErrors: rig.rider.arms.map((arm) => tip(arm.lower, 0.405).distanceTo(arm.contact.position)),
  };
}
