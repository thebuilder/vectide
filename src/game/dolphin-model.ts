import * as T from 'three';
import { loft } from './modeling';
import { addDolphinBend, poseDolphin } from './dolphin-pose';

/** Shared geometry keeps the three-animal pod inexpensive on phones. Faces +Z. */
export function createDolphinModel() {
  const dolphin = new T.Group();
  const skin = new T.MeshStandardMaterial({
    color: 0x93b6bf,
    metalness: 0.08,
    roughness: 0.38,
  });
  const body = loft(
    [
      { at: -1.4, width: 0.065, depth: 0.065 },
      { at: -1.1, width: 0.11, depth: 0.13 },
      { at: -0.7, width: 0.22, depth: 0.24 },
      { at: -0.2, width: 0.34, depth: 0.34 },
      { at: 0.3, width: 0.37, depth: 0.37 },
      { at: 0.65, width: 0.32, depth: 0.35, shift: 0.055 },
      { at: 0.88, width: 0.27, depth: 0.29, shift: 0.08 },
      { at: 1.03, width: 0.16, depth: 0.17, shift: 0.01 },
      { at: 1.13, width: 0.1, depth: 0.065, shift: -0.095 },
      { at: 1.48, width: 0.08, depth: 0.045, shift: -0.09 },
      { at: 1.57, width: 0.035, depth: 0.025, shift: -0.09 },
    ],
    20,
    'z',
  );
  const positions = body.getAttribute('position');
  const colors: number[] = [];
  const belly = new T.Color(0xd9e6df),
    back = new T.Color(0x7699a4);
  for (let i = 0; i < positions.count; i++) {
    const color = belly.clone().lerp(back, T.MathUtils.smoothstep(positions.getY(i), -0.2, 0.18));
    colors.push(color.r, color.g, color.b);
  }
  body.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  dolphin.add(
    new T.Mesh(body, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 })),
  );

  // Thin curved profiles give the fins a swept silhouette instead of cone spikes.
  const fin = (shape: T.Shape) => {
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 8,
    });
    geometry.translate(0, 0, -0.0175);
    return new T.Mesh(geometry, skin);
  };
  const dorsalShape = new T.Shape();
  dorsalShape.moveTo(-0.42, 0);
  dorsalShape.bezierCurveTo(-0.25, 0.16, -0.05, 0.4, 0.23, 0.44);
  dorsalShape.bezierCurveTo(0.1, 0.25, 0.17, 0.09, 0.4, 0);
  dorsalShape.closePath();
  const dorsal = fin(dorsalShape);
  dorsal.name = 'dorsal-fin';
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(0, 0.24, -0.15);
  dolphin.add(dorsal);

  const flipperShape = new T.Shape();
  flipperShape.moveTo(0, 0.12);
  flipperShape.bezierCurveTo(0.35, 0.06, 0.58, -0.25, 0.66, -0.48);
  flipperShape.bezierCurveTo(0.38, -0.4, 0.12, -0.21, 0, -0.13);
  flipperShape.closePath();
  for (const side of [-1, 1]) {
    const flipper = fin(flipperShape);
    flipper.rotation.x = Math.PI / 2;
    flipper.rotation.z = -side * 0.2;
    flipper.scale.x = side;
    flipper.position.set(side * 0.27, -0.17, 0.28);
    dolphin.add(flipper);
    const eye = new T.Mesh(
      new T.SphereGeometry(0.033, 8, 6),
      new T.MeshStandardMaterial({ color: 0x07171e, roughness: 0.2 }),
    );
    eye.position.set(side * 0.269, 0.065, 0.865);
    dolphin.add(eye);
    const mouth = new T.Line(
      new T.BufferGeometry().setFromPoints([
        new T.Vector3(side * 0.078, -0.09, 1.48),
        new T.Vector3(side * 0.103, -0.095, 1.12),
        new T.Vector3(side * 0.235, -0.055, 0.92),
      ]),
      new T.LineBasicMaterial({ color: 0x36535d }),
    );
    dolphin.add(mouth);
  }
  const tailShape = new T.Shape();
  tailShape.moveTo(0, 0.13);
  tailShape.bezierCurveTo(0.25, 0.17, 0.57, -0.05, 0.78, -0.31);
  tailShape.bezierCurveTo(0.46, -0.23, 0.17, -0.35, 0, -0.18);
  tailShape.bezierCurveTo(-0.17, -0.35, -0.46, -0.23, -0.78, -0.31);
  tailShape.bezierCurveTo(-0.57, -0.05, -0.25, 0.17, 0, 0.13);
  const tail = fin(tailShape);
  tail.name = 'tail-flukes';
  tail.scale.x = 1.25;
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -1.35;
  dolphin.add(tail);
  addDolphinBend(dolphin);
  poseDolphin(dolphin, 1.25);
  return dolphin;
}
