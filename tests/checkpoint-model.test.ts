import { expect, it } from 'vitest';
import { Box3, BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import {
  CHECKPOINT_POST_REACH,
  CHECKPOINT_POST_DEPTH,
  createCheckpointPost,
} from '../src/game/checkpoint-model';
import { createWorld } from '../src/game/visuals';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { MusicSpectrum } from '../src/game/spectrum';

it('keeps the wider flag separated from the mast and within the guidance bounds', () => {
  const post = createCheckpointPost(0x86fadd);
  const flag = post.group.getObjectByName('flag')!;
  expect(flag.position.x).toBeGreaterThan(0.5);
  for (const t of [0, 0.5, 1, 2, 3]) {
    post.update(t, true, 1, false);
    const bounds = new Box3().setFromObject(post.group, true);
    expect(bounds.max.x).toBeLessThanOrEqual(CHECKPOINT_POST_REACH);
    expect(Math.max(Math.abs(bounds.min.z), bounds.max.z)).toBeLessThanOrEqual(
      CHECKPOINT_POST_DEPTH,
    );
    expect(bounds.max.y).toBeLessThan(10);
  }
});

it('animates and accents only the current checkpoint, then settles when it changes', () => {
  const track = TRACKS[0],
    world = createWorld(track),
    racer = createRacer(track, 0),
    music = new MusicSpectrum();
  racer.nextGate = 1;
  const post = world.gates[1].getObjectByName('buoy')!;
  const flag = post.getObjectByName('flag') as Mesh,
    ring = post.getObjectByName('beacon-ring')!;
  const positions = () => Array.from(flag.geometry.getAttribute('position').array);
  const nextPost = world.gates[2].getObjectByName('buoy')!;
  world.update(1, racer, undefined, track, false, music);
  const first = positions();
  world.update(2, racer, undefined, track, false, music);
  expect(positions()).not.toEqual(first);
  expect(ring.rotation.y).not.toBe(0);
  const nextFlag = nextPost.getObjectByName('flag') as Mesh;
  const settled = Array.from(nextFlag.geometry.getAttribute('position').array);
  expect(nextPost.getObjectByName('beacon-ring')!.rotation.y).toBe(0);
  const beacon = post.getObjectByName('beacon')!.children[0] as Mesh;
  const material = beacon.material as MeshBasicMaterial;
  const quiet = material.color.clone();
  const beforeBeat = positions();
  music.beatStrength = 1;
  world.update(2, racer, undefined, track, false, music);
  expect(positions()).toEqual(beforeBeat);
  expect(material.color.g).toBeGreaterThan(quiet.g);
  expect(ring.scale.x).toBeCloseTo(1.18);
  racer.nextGate = 2;
  world.update(3, racer, undefined, track, false, music);
  expect(positions()).toEqual(settled);
  expect(ring.rotation.y).toBe(0);
  expect(ring.scale.x).toBeCloseTo(0.85);
  world.dispose();
});

it('retains a steady active beacon with muted music and removes decorative motion when reduced', () => {
  const track = TRACKS[0],
    world = createWorld(track),
    racer = createRacer(track, 0),
    music = new MusicSpectrum();
  racer.nextGate = 1;
  music.beatStrength = 1;
  const post = world.gates[1].getObjectByName('buoy')!;
  const ring = post.getObjectByName('beacon-ring')!;
  world.update(1, racer, undefined, track, false, music);
  world.update(2, racer, undefined, track, false);
  expect(ring.scale.x).toBe(1);
  world.update(3, racer, undefined, track, true, music);
  expect(ring.rotation.y).toBe(0);
  expect(ring.scale.x).toBe(1);
  expect(post.getObjectByName('flag')!.rotation.y).toBe(0);
  const flag = post.getObjectByName('flag') as Mesh;
  const still = Array.from(flag.geometry.getAttribute('position').array);
  world.update(6, racer, undefined, track, true, music);
  expect(Array.from(flag.geometry.getAttribute('position').array)).toEqual(still);
  world.dispose();
});

it('paints the emblem onto the fabric and releases its texture with the world', () => {
  const world = createWorld(TRACKS[0]);
  const flag = world.gates[1].getObjectByName('flag') as Mesh;
  const texture = (flag.material as MeshStandardMaterial).map!;
  const pixels = texture.image.data as Uint8Array;
  expect(pixels).toContain(7);
  expect(pixels).toContain(255);
  let disposed = false;
  texture.addEventListener('dispose', () => {
    disposed = true;
  });
  world.dispose();
  expect(disposed).toBe(true);
});

it('does not rebuild cloth at a frozen simulation time or while its gate is hidden', () => {
  const track = TRACKS[0],
    world = createWorld(track),
    racer = createRacer(track, 0);
  racer.nextGate = 1;
  const gate = world.gates[1];
  const flag = gate.getObjectByName('flag') as Mesh;
  const vertices = flag.geometry.getAttribute('position') as BufferAttribute;
  world.update(1, racer, undefined, track, false);
  const frozenVersion = vertices.version;
  world.update(1, racer, undefined, track, false);
  expect(vertices.version).toBe(frozenVersion);
  gate.visible = false;
  world.update(2, racer, undefined, track, false);
  const hiddenVersion = vertices.version;
  world.update(3, racer, undefined, track, false);
  expect(vertices.version).toBe(hiddenVersion);
  gate.visible = true;
  world.update(4, racer, undefined, track, false);
  expect(vertices.version).toBeGreaterThan(hiddenVersion);
  world.dispose();
});
