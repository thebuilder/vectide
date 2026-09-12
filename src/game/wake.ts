import * as T from 'three';
import type { Racer } from './physics';
import { waterHeight, type WaterProfile } from './water';

type Point = { x: number; z: number; yaw: number; time: number; pace: number };
const RIDERS = 12,
  POINTS = 72,
  LIFETIME = 2.4;
/** Two continuous foam seams follow each hull's actual path and the displaced water. */
export class Wake {
  readonly object: T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
  private trails = new Map<number, Point[]>();
  private positions = new Float32Array(RIDERS * POINTS * 4 * 3);
  private across = new Float32Array(RIDERS * POINTS * 4);
  private opacity = new Float32Array(RIDERS * POINTS * 4);
  private indices = new Uint16Array(RIDERS * (POINTS - 1) * 12);
  activeSegments = 0;
  constructor() {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.BufferAttribute(this.positions, 3).setUsage(T.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'opacity',
      new T.BufferAttribute(this.opacity, 1).setUsage(T.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'across',
      new T.BufferAttribute(this.across, 1).setUsage(T.DynamicDrawUsage),
    );
    geometry.setIndex(new T.BufferAttribute(this.indices, 1).setUsage(T.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.object = new T.Mesh(
      geometry,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        vertexShader:
          'attribute float opacity; attribute float across; varying float vOpacity; varying float vAcross; void main(){vOpacity=opacity;vAcross=across;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'varying float vOpacity; varying float vAcross; void main(){gl_FragColor=vec4(.38,.8,.69,vOpacity*pow(max(0.,1.-abs(vAcross)),.65));}',
      }),
    );
    this.object.frustumCulled = false;
    this.object.name = 'hull-wakes';
  }
  clear() {
    this.trails.clear();
    this.activeSegments = 0;
    this.object.geometry.setDrawRange(0, 0);
  }
  update(racers: Racer[], time: number, water: WaterProfile) {
    const ids = new Set(racers.map((r) => r.id));
    for (const id of this.trails.keys()) if (!ids.has(id)) this.trails.delete(id);
    let vertex = 0,
      index = 0;
    const write = (p: Point, side: number, edge: number) => {
      const age = Math.max(0, time - p.time),
        spread = 0.65 + age * (1.1 + p.pace * 0.7),
        width = 0.12 + age * 0.17,
        lateral = side * (spread + edge * width),
        x = p.x + Math.cos(p.yaw) * lateral,
        z = p.z - Math.sin(p.yaw) * lateral;
      const offset = vertex * 3;
      this.positions[offset] = x;
      this.positions[offset + 1] = waterHeight(x, z, time, water) + 0.055;
      this.positions[offset + 2] = z;
      this.across[vertex] = edge;
      this.opacity[vertex++] = Math.pow(Math.max(0, 1 - age / LIFETIME), 1.6) * p.pace * 0.5;
    };
    for (const r of racers.slice(0, RIDERS)) {
      let trail = this.trails.get(r.id) ?? [];
      const last = trail.at(-1),
        speed = Math.hypot(r.vx, r.vz);
      if (
        r.wet === 0 ||
        r.onRamp ||
        r.recovery.phase !== 'riding' ||
        (last &&
          (time < last.time ||
            Math.hypot(r.x - Math.sin(r.yaw) * 1.7 - last.x, r.z - Math.cos(r.yaw) * 1.7 - last.z) >
              12))
      ) {
        trail = [];
      } else if (speed > 3) {
        const point = {
          x: r.x - Math.sin(r.yaw) * 1.7,
          z: r.z - Math.cos(r.yaw) * 1.7,
          yaw: r.yaw,
          time,
          pace: Math.min(speed / 22, 1),
        };
        if (!last || Math.hypot(point.x - last.x, point.z - last.z) >= 0.75) trail.push(point);
      }
      trail = trail.filter((p) => time - p.time < LIFETIME).slice(-POINTS);
      this.trails.set(r.id, trail);
      const base = vertex;
      for (const point of trail) {
        write(point, -1, -1);
        write(point, -1, 1);
        write(point, 1, -1);
        write(point, 1, 1);
      }
      for (let i = 1; i < trail.length; i++) {
        for (let side = 0; side < 2; side++) {
          const a = base + (i - 1) * 4 + side * 2,
            b = a + 4;
          this.indices[index++] = a;
          this.indices[index++] = b;
          this.indices[index++] = b + 1;
          this.indices[index++] = a;
          this.indices[index++] = b + 1;
          this.indices[index++] = a + 1;
        }
      }
    }
    this.activeSegments = index / 12;
    this.object.geometry.setDrawRange(0, index);
    this.object.geometry.index!.needsUpdate = true;
    this.object.geometry.attributes.position.needsUpdate = true;
    this.object.geometry.attributes.opacity.needsUpdate = true;
    this.object.geometry.attributes.across.needsUpdate = true;
  }
  dispose() {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
