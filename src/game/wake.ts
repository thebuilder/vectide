import * as T from 'three';
import type { Racer } from './physics';
import type { Spectrum } from './spectrum';
import { waterHeight, type WaterProfile } from './water';

type Point = {
  x: number;
  z: number;
  yaw: number;
  time: number;
  pace: number;
  travel: number;
  connected: boolean;
};
const RIDERS = 12,
  POINTS = 72,
  LIFETIME = 2.4;
/** Broken foam fills the widening trail behind each hull and follows the displaced water. */
export class Wake {
  readonly object: T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
  private airborne = new Set<number>();
  private trails = new Map<number, Point[]>();
  private positions = new Float32Array(RIDERS * POINTS * 4 * 3);
  private across = new Float32Array(RIDERS * POINTS * 4);
  private flow = new Float32Array(RIDERS * POINTS * 4 * 2);
  private opacity = new Float32Array(RIDERS * POINTS * 4);
  private indices = new Uint16Array(RIDERS * (POINTS - 1) * 18);
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
    geometry.setAttribute('flow', new T.BufferAttribute(this.flow, 2).setUsage(T.DynamicDrawUsage));
    geometry.setIndex(new T.BufferAttribute(this.indices, 1).setUsage(T.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.object = new T.Mesh(
      geometry,
      new T.ShaderMaterial({
        uniforms: { uMusic: { value: new T.Vector3() } },
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        vertexShader:
          'attribute float opacity; attribute float across; attribute vec2 flow; varying float vOpacity; varying float vAcross; varying vec2 vFlow; void main(){vOpacity=opacity;vAcross=across;vFlow=flow;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform vec3 uMusic;
          varying float vOpacity;
          varying float vAcross;
          varying vec2 vFlow;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);
            float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
            return f.x+f.y<1. ? a+(b-a)*f.x+(c-a)*f.y : d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);
          }
          void main(){
            vec2 flow=vFlow*vec2(7.2,5.1);
            float churn=noise(flow)*.6+noise(flow*3.7)*.4;
            float edge=1.-abs(vAcross);
            float feather=smoothstep(0.,.28,edge+(noise(flow*.8)-.5)*.28);
            float foam=smoothstep(.4,.6,churn+edge*.08);
            vec3 color=mix(vec3(.12,.44,.36),vec3(.72,1.,.88),foam);
            // Music lights the churn while keeping the foam's full silhouette and contact trail.
            color+=mix(vec3(.015,.1,.07),vec3(.08,.035,.1),uMusic.y)*uMusic.x*foam;
            color+=vec3(.035,.05,.06)*uMusic.z*smoothstep(.63,.8,churn);
            gl_FragColor=vec4(color,vOpacity*foam*feather);
          }`,
      }),
    );
    this.object.frustumCulled = false;
    this.object.name = 'hull-wakes';
  }
  clear() {
    this.trails.clear();
    this.airborne.clear();
    this.activeSegments = 0;
    this.object.geometry.setDrawRange(0, 0);
  }
  reactToMusic(bands: Spectrum, dt: number, enabled = true) {
    const value = this.object.material.uniforms.uMusic.value as T.Vector3;
    if (!enabled) {
      value.set(0, 0, 0);
      return;
    }
    const blend = 1 - Math.exp(-dt * 3);
    value.x += (bands.low - value.x) * blend;
    value.y += (bands.mid - value.y) * blend;
    value.z += (bands.high - value.z) * blend;
  }
  update(racers: Racer[], time: number, water: WaterProfile) {
    const ids = new Set(racers.map((r) => r.id));
    for (const id of this.trails.keys())
      if (!ids.has(id)) {
        this.trails.delete(id);
        this.airborne.delete(id);
      }
    let vertex = 0,
      index = 0;
    const write = (p: Point, across: number) => {
      const age = Math.max(0, time - p.time),
        width = 0.9 + age * (1.5 + p.pace * 0.65),
        lateral = across * width,
        x = p.x + Math.cos(p.yaw) * lateral,
        z = p.z - Math.sin(p.yaw) * lateral;
      const offset = vertex * 3;
      this.positions[offset] = x;
      this.positions[offset + 1] = waterHeight(x, z, time, water) + 0.055;
      this.positions[offset + 2] = z;
      this.across[vertex] = across;
      this.flow[vertex * 2] = lateral;
      this.flow[vertex * 2 + 1] = p.travel;
      const contact = Math.min(age / 0.16, 1);
      this.opacity[vertex++] =
        contact * (2 - contact) * Math.pow(Math.max(0, 1 - age / LIFETIME), 1.15) * p.pace * 0.92;
    };
    for (const r of racers.slice(0, RIDERS)) {
      let trail = this.trails.get(r.id) ?? [];
      const last = trail.at(-1),
        speed = Math.hypot(r.vx, r.vz);
      if (
        r.recovery.phase !== 'riding' ||
        (last &&
          !this.airborne.has(r.id) &&
          (time < last.time ||
            Math.hypot(r.x - Math.sin(r.yaw) * 1.7 - last.x, r.z - Math.cos(r.yaw) * 1.7 - last.z) >
              12))
      ) {
        trail = [];
        this.airborne.delete(r.id);
      } else if (r.wet === 0 || r.onRamp) {
        this.airborne.add(r.id);
      } else if (speed > 3) {
        const point = {
          x: r.x - Math.sin(r.yaw) * 1.7,
          z: r.z - Math.cos(r.yaw) * 1.7,
          yaw: r.yaw,
          time,
          connected: !this.airborne.has(r.id),
          pace: Math.min(speed / 22, 1),
          travel: last
            ? last.travel +
              Math.hypot(r.x - Math.sin(r.yaw) * 1.7 - last.x, r.z - Math.cos(r.yaw) * 1.7 - last.z)
            : 0,
        };
        if (
          !last ||
          this.airborne.has(r.id) ||
          Math.hypot(point.x - last.x, point.z - last.z) >= 0.75
        ) {
          trail.push(point);
          this.airborne.delete(r.id);
        }
      }
      trail = trail.filter((p) => time - p.time < LIFETIME).slice(-POINTS);
      this.trails.set(r.id, trail);
      const base = vertex;
      for (const point of trail) {
        write(point, -1);
        write(point, -1 / 3);
        write(point, 1 / 3);
        write(point, 1);
      }
      for (let i = 1; i < trail.length; i++) {
        if (!trail[i].connected) continue;
        for (let side = 0; side < 3; side++) {
          const a = base + (i - 1) * 4 + side,
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
    this.activeSegments = index / 18;
    this.object.geometry.setDrawRange(0, index);
    this.object.geometry.index!.needsUpdate = true;
    this.object.geometry.attributes.position.needsUpdate = true;
    this.object.geometry.attributes.opacity.needsUpdate = true;
    this.object.geometry.attributes.across.needsUpdate = true;
    this.object.geometry.attributes.flow.needsUpdate = true;
  }
  dispose() {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
