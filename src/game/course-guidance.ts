import * as T from 'three';
import type { CourseTurnSign } from './course-layout';
import { box, glowing } from './geometry';
import type { Track } from './tracks';

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
  for (const sign of track.turnSigns ?? []) parent.add(createTurnBoard(sign));
}
