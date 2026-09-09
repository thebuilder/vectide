import { stepRiderLoad } from '../src/game/rider-load';
import { describe, it, expect } from 'vitest';
import { Vector3, Euler } from 'three';
import {
  createRiderPose,
  stepRiderPose,
  solveJoint,
  fitRootToContacts,
  boneOrientation,
} from '../src/game/rider-pose';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

describe('rider reactions', () => {
  it('leans into either turn with mirrored motion', () => {
    const left = createRiderPose(),
      right = createRiderPose();
    const a = createRacer(TRACKS[0], 0),
      b = createRacer(TRACKS[0], 1);
    a.vx = b.vx = 25;
    a.steer = 1;
    b.steer = -1;
    for (let i = 0; i < 60; i++) {
      stepRiderLoad(a, { throttle: 1, steer: 1, brake: 0, lean: 0 }, 1 / 60);
      stepRiderLoad(b, { throttle: 1, steer: -1, brake: 0, lean: 0 }, 1 / 60);
      stepRiderPose(left, a, 1 / 60);
      stepRiderPose(right, b, 1 / 60);
    }
    expect(left.lean).toBeGreaterThan(0.17);
    expect(right.lean).toBeCloseTo(-left.lean, 6);
  });
  it('compresses the knees on a landing and settles afterwards', () => {
    const pose = createRiderPose(),
      r = createRacer(TRACKS[0], 0);
    r.wet = 0;
    r.vy = -8;
    stepRiderPose(pose, r, 1 / 60);
    const flight = pose.compression;
    r.wet = 1;
    r.vy = 1;
    for (let i = 0; i < 8; i++) stepRiderPose(pose, r, 1 / 60);
    expect(pose.compression).toBeGreaterThan(flight + 0.03);
    expect(pose.impact).toBeGreaterThan(0);
    r.vy = 0;
    for (let i = 0; i < 180; i++) stepRiderPose(pose, r, 1 / 60);
    expect(pose.compression).toBeCloseTo(0.1, 2);
    expect(pose.impact).toBeLessThan(0.001);
  });
  it('reacts to a rising wave without needing to become airborne', () => {
    const pose = createRiderPose(),
      r = createRacer(TRACKS[0], 0);
    const before = pose.compression;
    for (let i = 0; i < 10; i++) {
      r.vy = i * 0.25;
      stepRiderPose(pose, r, 1 / 60);
    }
    expect(pose.compression).toBeGreaterThan(before + 0.05);
  });
  it('freezes when paused and is consistent across rendering rates', () => {
    const slow = createRiderPose(),
      fast = createRiderPose(),
      r = createRacer(TRACKS[0], 0);
    r.vx = 25;
    r.steer = 0.8;
    const frozen = { ...slow };
    stepRiderPose(slow, r, 0);
    expect(slow).toEqual(frozen);
    for (let i = 0; i < 30; i++) stepRiderPose(slow, r, 1 / 30);
    for (let i = 0; i < 120; i++) stepRiderPose(fast, r, 1 / 120);
    expect(slow.lean).toBeCloseTo(fast.lean, 5);
    expect(slow.compression).toBeCloseTo(fast.compression, 2);
  });
});

it('bends two bones while preserving lengths and the fixed contact point', () => {
  const hip = new Vector3(0.2, 0.94, -0.6),
    foot = new Vector3(0.51, 0.24, -0.88),
    pole = new Vector3(0.6, 0.5, 0.1);
  const knee = solveJoint(hip, foot, 0.55, 0.53, pole);
  expect(knee.distanceTo(hip)).toBeCloseTo(0.55, 7);
  expect(knee.distanceTo(foot)).toBeCloseTo(0.53, 7);
  expect(knee.z).toBeGreaterThan(hip.z);
  const compressed = solveJoint(hip.clone().add(new Vector3(0, -0.2, 0)), foot, 0.55, 0.53, pole);
  expect(compressed.z).toBeGreaterThan(knee.z);
});

it('keeps every limb within reach at extreme compression, pitch and turn angles', () => {
  for (const compression of [0.04, 0.2, 0.36])
    for (const lean of [-0.19, 0, 0.19])
      for (const pitch of [-0.4, 0.12, 0.65])
        for (const roll of [-0.9, 0, 0.9]) {
          const rotation = new Euler(pitch, Math.sign(lean) * 0.07, -lean * 1.25 - roll * 0.2),
            root = new Vector3(lean, 1.12 - compression, -0.27 - Math.max(0, pitch - 0.25) * 0.2);
          const contacts = [-1, 1].flatMap((side) => [
            {
              offset: new Vector3(side * 0.17, 0, 0).applyEuler(rotation),
              target: new Vector3(side * 0.51, 0.24, -0.7),
              reach: 1.077,
            },
            {
              offset: new Vector3(side * 0.29, 0.535, 0).applyEuler(rotation),
              target: new Vector3(side * 0.52, 0, 0)
                .applyAxisAngle(new Vector3(0, 1, 0), Math.sign(lean) * 0.24)
                .add(new Vector3(0, 1.24, 0.28)),
              reach: 0.807,
            },
          ]);
          fitRootToContacts(root, contacts);
          for (const contact of contacts)
            expect(root.clone().add(contact.offset).distanceTo(contact.target)).toBeLessThanOrEqual(
              contact.reach + 0.00001,
            );
        }
});

it('keeps the shin guard facing forward as the leg crosses vertical', () => {
  let previous;
  for (let x = -0.2; x <= 0.2; x += 0.002) {
    const from = new Vector3(0, 1, 0),
      to = new Vector3(x, 0, -0.02);
    const orientation = boneOrientation(from, to);
    const front = new Vector3(0, 0, 1).applyQuaternion(orientation);
    const bone = new Vector3(0, 1, 0).applyQuaternion(orientation);
    expect(front.z).toBeGreaterThan(0.99);
    expect(bone.dot(to.clone().sub(from).normalize())).toBeCloseTo(1, 6);
    if (previous) expect(Math.abs(previous.dot(orientation))).toBeGreaterThan(0.999);
    previous = orientation;
  }
});

it('keeps the torso more upright as the jet ski pitches down a wave', () => {
  const pose = createRiderPose(),
    r = createRacer(TRACKS[0], 0);
  r.pitch = -0.45;
  for (let i = 0; i < 120; i++) stepRiderPose(pose, r, 1 / 120);
  const worldLean = pose.forward - r.pitch;
  expect(worldLean).toBeGreaterThan(0);
  expect(worldLean).toBeLessThan(0.23);
});

it('leans the torso back on command and returns to neutral on release', () => {
  const r = createRacer(TRACKS[0], 0),
    pose = createRiderPose();
  r.lean = 1;
  for (let i = 0; i < 60; i++) {
    stepRiderLoad(r, { throttle: 0, steer: 0, brake: 0, lean: r.lean }, 1 / 60);
    stepRiderPose(pose, r, 1 / 60);
  }
  expect(pose.forward).toBeLessThan(-0.2);
  r.lean = 0;
  for (let i = 0; i < 60; i++) {
    stepRiderLoad(r, { throttle: 0, steer: 0, brake: 0, lean: r.lean }, 1 / 60);
    stepRiderPose(pose, r, 1 / 60);
  }
  expect(pose.forward).toBeCloseTo(0.12, 2);
});
