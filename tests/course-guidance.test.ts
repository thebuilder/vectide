import { expect, it } from 'vitest';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { courseGuidePosts, addCourseGuidance } from '../src/game/course-guidance';
import { gatePointClear } from '../src/game/course-layout';
import { addTerrain } from '../src/game/terrain-visuals';
import { TRACKS } from '../src/game/tracks';

it('keeps harbor docks free of offshore wind turbines', () => {
  expect(addTerrain(new Group(), TRACKS[1])).toHaveLength(0);
});

it.each(TRACKS)(
  'keeps $name marked between gates without putting guide posts in the racing line',
  (track) => {
    const posts = courseGuidePosts(track);
    for (const post of posts) {
      expect(gatePointClear(post.x, post.z, track.land)).toBe(true);
      expect(
        Math.min(...track.points.map((p) => Math.hypot(p.x - post.x, p.z - post.z))),
      ).toBeGreaterThan(5);
    }
    for (const point of track.points) {
      const distance = Math.min(
        ...posts.map((p) => Math.hypot(p.x - point.x, p.z - point.z)),
        ...track.gates.map((g) => Math.hypot(g.x - point.x, g.z - point.z)),
      );
      expect(distance).toBeLessThan(38);
    }
  },
);

for (const [index, gateName, boardName] of [
  [0, 'Start / finish', 'Crescent approach turn board'],
  [0, 'Reef entrance', 'Outer reef exit turn board'],
  [1, 'Start / finish', 'Entrance channel turn board'],
  [1, 'Inner basin', 'Inner basin left-turn board'],
  [1, 'Harbor mouth', 'Cargo terminal turn board'],
  [2, 'West approach', 'West approach turn board'],
  [2, 'Cross-swell reef', 'East sweep turn board'],
  [2, 'East channel', 'East channel turn board'],
  [2, 'Signal east turn', 'Signal approach turn board'],
  [2, 'Signal north turn', 'Home sweep turn board'],
] as const) {
  it(`shows ${boardName} before crossing ${gateName}`, () => {
    const track = TRACKS[index];
    const world = new Group();
    addTerrain(world, track);
    addCourseGuidance(world, track);
    world.updateMatrixWorld(true);
    const board = world.getObjectByName(boardName)!;
    const definition = track.turnSigns!.find((s) => s.name === boardName)!;
    const gate = track.gates.find((g) => g.name === gateName)!;
    const meshes: Mesh[] = [];
    world.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    for (const distance of [45, 20]) {
      const approach =
        gate.routeIndex === 0
          ? { x: gate.x - gate.tx * distance, z: gate.z - gate.tz * distance }
          : track.points[
              (gate.routeIndex! -
                Math.ceil((distance / track.length) * track.points.length) +
                track.points.length) %
                track.points.length
            ];
      const eye = new Vector3(approach.x, 4, approach.z);
      for (const side of [-1, 0, 1]) {
        const target = board.localToWorld(
          new Vector3(side * (definition.width ?? 24) * 0.29, definition.height ?? 5, 0.46),
        );
        const toward = target.clone().sub(eye);
        const horizontal = Math.hypot(toward.x, toward.z);
        expect((toward.x * gate.tx + toward.z * gate.tz) / horizontal).toBeGreaterThan(0.65);
        const hit = new Raycaster(eye, toward.normalize()).intersectObjects(meshes, false)[0];
        expect(hit, `from ${distance}m before gate`).toBeDefined();
        let object = hit.object;
        while (object.parent && object !== board) object = object.parent;
        expect(object.name, `occluded by ${hit.object.name} from ${distance}m before gate`).toBe(
          boardName,
        );
      }
    }
  });
}

it('keeps every next Storm checkpoint ahead and unobscured by terrain', () => {
  const track = TRACKS[2];
  const world = new Group();
  addTerrain(world, track);
  world.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  world.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  for (const [index, first] of track.gates.entries()) {
    const next = track.gates[(index + 1) % track.gates.length];
    const direction = new Vector3(next.x - first.x, 0, next.z - first.z).normalize();
    expect(
      direction.x * first.tx + direction.z * first.tz,
      `${first.name} to ${next.name}`,
    ).toBeGreaterThan(0.35);
    for (const distance of [30, 0]) {
      const approach =
        index === 0
          ? { x: first.x - first.tx * distance, z: first.z - first.tz * distance }
          : track.points[
              (first.routeIndex! -
                Math.ceil((distance / track.length) * track.points.length) +
                track.points.length) %
                track.points.length
            ];
      const eye = new Vector3(approach.x, 4, approach.z);
      for (const side of [-1, 1]) {
        const target = new Vector3(
          next.x - (next.tz * next.width * side) / 2,
          8.75,
          next.z + (next.tx * next.width * side) / 2,
        );
        const length = target.distanceTo(eye);
        const hits = new Raycaster(eye, target.sub(eye).normalize(), 0, length).intersectObjects(
          meshes,
          false,
        );
        expect(
          hits.map((hit) => hit.object.name),
          `${first.name} to ${next.name}, ${distance}m before gate`,
        ).toEqual([]);
      }
    }
  }
});
