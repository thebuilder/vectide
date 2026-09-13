import * as T from 'three';
import { fitGateToShore, type CourseTurnSign } from './course-layout';
import { box, dark, glowing } from './geometry';
import type { Point, Track } from './tracks';

export interface CourseGuidePost extends Point {
  side: -1 | 1;
}

/** The same red/green banks continue between checkpoints, leaving racing lines open. */
export function courseGuidePosts(track: Track): CourseGuidePost[] {
  if (track.practiceRadius) return [];
  const posts: CourseGuidePost[] = [];
  const count = Math.ceil(track.length / 24);
  for (let step = 0; step < count; step++) {
    const index = Math.floor((step * track.points.length) / count);
    const point = track.points[index];
    if (track.gates.some((gate) => Math.hypot(gate.x - point.x, gate.z - point.z) < 14)) continue;
    const before = track.points[(index - 2 + track.points.length) % track.points.length];
    const after = track.points[(index + 2) % track.points.length];
    const length = Math.hypot(after.x - before.x, after.z - before.z);
    const tx = (after.x - before.x) / length;
    const tz = (after.z - before.z) / length;
    const bank = fitGateToShore(
      { ...point, tx, tz, width: track.id === 'harbor' ? 38 : 48 },
      track.land,
    );
    for (const side of [-1, 1] as const) {
      const x = bank.x - (tz * bank.width * side) / 2;
      const z = bank.z + (tx * bank.width * side) / 2;
      // A narrow natural bank already marks the edge; keep posts away from the racing center.
      if (Math.hypot(x - point.x, z - point.z) < 8) continue;
      posts.push({ x, z, side });
    }
  }
  return posts;
}

export function createTurnBoard(definition: CourseTurnSign): T.Group {
  const board = new T.Group();
  board.name = definition.name;
  board.position.set(definition.at[0], definition.baseHeight ?? 3, definition.at[1]);
  board.rotation.y = Math.atan2(...definition.facing);
  const width = definition.width ?? 24;
  const height = definition.height ?? 5;
  const foot = -4 - board.position.y;
  for (const x of [-width * 0.35, width * 0.35])
    box(board, 0.55, height - foot, 0.55, x, (height + foot) / 2, 0, 0x597477);
  box(board, width, 7, 0.8, 0, height, 0, 0xffbc57);
  const shape = new T.Shape();
  const direction = definition.direction === 'right' ? 1 : -1;
  const points = [
    [-2, -2.4],
    [-0.2, -2.4],
    [2.4, 0],
    [-0.2, 2.4],
    [-2, 2.4],
    [0.6, 0],
  ];
  shape.moveTo(points[0][0] * direction, points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x * direction, y);
  shape.closePath();
  const material = glowing(0xffbc57, 1);
  material.toneMapped = false;
  for (const x of [-width * 0.29, 0, width * 0.29]) {
    const arrow = new T.Mesh(new T.ShapeGeometry(shape), material);
    arrow.position.set(x, height, 0.45);
    board.add(arrow);
  }
  return board;
}

export function addCourseGuidance(parent: T.Group, track: Track): void {
  if (track.practiceRadius) return;
  const pink = glowing(0xff5b82, 1);
  const mint = glowing(0x86fadd, 1);
  pink.toneMapped = mint.toneMapped = false;
  for (const post of courseGuidePosts(track)) {
    const group = new T.Group();
    group.name = 'Course guide post';
    group.position.set(post.x, 0, post.z);
    const material = post.side < 0 ? pink : mint;
    const pole = new T.Mesh(new T.CylinderGeometry(0.14, 0.22, 8.6, 4), dark);
    pole.position.y = 0.1;
    const cap = new T.Mesh(new T.OctahedronGeometry(0.8), material);
    cap.position.y = 4.8;
    const band = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 1.4, 4), material);
    band.position.y = 3.4;
    group.add(pole, cap, band);
    parent.add(group);
  }
  for (const sign of track.turnSigns ?? []) parent.add(createTurnBoard(sign));
}
