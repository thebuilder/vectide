import * as T from 'three';
import type { Spectrum } from './spectrum';
import { createMusicVisuals } from './music-visuals';
import { batchStatic } from './batch';
import { CELL, waterHeight } from './water';
import { createWaterMaterial } from './water-material';
import { type Track } from './tracks';
import { type Racer } from './physics';

import { box, dark, glowing, outlined } from './geometry';
import { createPalm } from './palm';
import { createDolphins } from './dolphins';
import { addLandmarks } from './landmarks';
export interface World {
  group: T.Group;
  water: T.Mesh;
  waterMaterial: T.ShaderMaterial;
  gates: T.Group[];
  turbines: T.Group[];
  update: (t: number, player: Racer, bands?: Spectrum) => void;
  dispose: () => void;
}
export function createWorld(track: Track): World {
  const group = new T.Group(),
    gates: T.Group[] = [],
    turbines: T.Group[] = [];
  const skyGeo = new T.SphereGeometry(3000, 32, 16);
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new T.Color(track.sky) },
      bottom: { value: new T.Color(track.horizon) },
    },
    vertexShader:
      'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; void main(){float h=normalize(vPos).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.05,.5,h)),1.);}',
  });
  group.add(new T.Mesh(skyGeo, skyMat));
  // Striped disc with no texture download and no overdraw-heavy atmosphere particles.
  const sun = new T.Mesh(
    new T.CircleGeometry(240, 96),
    new T.ShaderMaterial({
      transparent: true,
      uniforms: { storm: { value: track.id === 'storm' ? 1 : 0 } },
      vertexShader:
        'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 vUv; uniform float storm;void main(){if(vUv.y<.48&&mod(vUv.y,.065)<.013)discard;vec3 c=mix(vec3(1.,.08,.32),vec3(1.,.66,.27),vUv.y);gl_FragColor=vec4(mix(c,vec3(.5,.67,.76),storm),1.);}',
    }),
  );
  sun.position.set(2300, 360, 500);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  const waterMaterial = createWaterMaterial(track);
  const waterGeo = new T.PlaneGeometry(1536, 1536, 1536 / CELL, 1536 / CELL);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new T.Mesh(waterGeo, waterMaterial);
  water.frustumCulled = false;
  group.add(water);
  const farWater = new T.Mesh(
    new T.PlaneGeometry(7000, 7000).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: track.water }),
  );
  farWater.position.y = -4;
  group.add(farWater);
  // The course is marked along both banks, leaving the middle open for racing lines.
  track.gates.forEach((g, i) => {
    const gate = new T.Group();
    gate.position.set(g.x, 0, g.z);
    for (const side of [-1, 1]) {
      const buoy = new T.Group();
      buoy.position.set(((-g.tz * g.width) / 2) * side, 0, ((g.tx * g.width) / 2) * side);
      const color = side < 0 ? 0xff5b82 : 0x86fadd;
      const base = outlined(new T.CylinderGeometry(0.55, 1.1, 0.9, 6), color);
      base.position.y = 0.5;
      buoy.add(base);
      const mast = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 3.5, 5), glowing(color, 1.3));
      mast.position.y = 2.2;
      buoy.add(mast);
      const top = new T.Mesh(new T.OctahedronGeometry(0.6), glowing(color, 1.8));
      top.position.y = 4;
      buoy.add(top);
      gate.add(buoy);
    }
    if (i === 0) {
      const bar = box(
        gate,
        g.width + 2,
        0.3,
        0.3,
        0,
        7,
        0,
        track.accent,
        glowing(track.accent, 1.5),
      );
      bar.rotation.y = Math.atan2(-g.tx, -g.tz);
      for (const side of [-1, 1])
        box(
          gate,
          0.3,
          7,
          0.3,
          ((-g.tz * g.width) / 2) * side,
          3.5,
          ((g.tx * g.width) / 2) * side,
          track.accent,
          glowing(track.accent),
        );
    }
    const marker = new T.Group();
    marker.name = 'next';
    const arrow = new T.Mesh(new T.ConeGeometry(1.2, 2, 3), glowing(0xffbc57, 1.1));
    arrow.rotation.x = Math.PI;
    arrow.position.y = 8;
    marker.add(arrow);
    gate.add(marker);
    gates.push(gate);
    group.add(gate);
  });
  track.ramps.forEach((r) => {
    const geo = new T.BufferGeometry();
    const w = r.width / 2,
      l = r.length / 2,
      h = r.height;
    geo.setAttribute(
      'position',
      new T.Float32BufferAttribute([-w, 0, -l, w, 0, -l, -w, h, l, w, 0, -l, w, h, l, -w, h, l], 3),
    );
    geo.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [-w, 0, -l, w, 0, -l, -w, h, l, w, h, l, -w, -1, -l, w, -1, -l, -w, -1, l, w, -1, l],
        3,
      ),
    );
    geo.setIndex([
      0, 2, 1, 1, 2, 3, 0, 4, 2, 4, 6, 2, 1, 3, 5, 5, 3, 7, 2, 6, 3, 3, 6, 7, 0, 1, 4, 1, 5, 4, 4,
      5, 6, 5, 7, 6,
    ]);
    geo.computeVertexNormals();
    const ramp = outlined(
      geo,
      0xffbc57,
      new T.MeshStandardMaterial({ color: 0x382934, side: T.DoubleSide, roughness: 0.6 }),
    );
    ramp.rotation.y = Math.atan2(r.tx, r.tz);
    ramp.position.set(r.x, r.baseHeight, r.z);
    group.add(ramp);
    for (let i = 0; i < 5; i++) {
      const mark = box(
        ramp,
        r.width,
        0.06,
        0.23,
        0,
        h * (i / 5),
        -l + (r.length * i) / 5,
        0xffbc57,
        glowing(0xffbc57),
      );
      mark.rotation.x = -Math.atan2(h, r.length);
    }
  });
  let seed = 17;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  track.obstacles.length = 0;
  // Landmarks sit outside the racing corridor and have matching collision volumes.
  for (let i = 0; i < track.points.length; i += 48) {
    const p = track.points[i],
      next = track.points[(i + 1) % track.points.length],
      dx = next.x - p.x,
      dz = next.z - p.z,
      len = Math.hypot(dx, dz),
      tx = dx / len,
      tz = dz / len;
    for (const side of [i % 96 === 0 ? -1 : 1]) {
      const offset = track.id === 'harbor' ? 42 + random() * 10 : 65 + random() * 35;
      const x = p.x - tz * offset * side,
        z = p.z + tx * offset * side;
      const clearanceRadius = track.id === 'palms' ? 18 : track.id === 'harbor' ? 17 : 8;
      if (
        track.points.some(
          (v) => Math.hypot(v.x - x, v.z - z) < clearanceRadius + track.gates[0].width / 2 + 3,
        )
      )
        continue;
      if (track.id === 'palms') {
        const island = outlined(new T.CylinderGeometry(14, 19, 3, 7), track.accent);
        island.position.set(x, 0.5, z);
        group.add(island);
        track.obstacles.push({ x, z, radius: 18 });
        island.scale.set(0.7 + random() * 0.5, 0.7 + random() * 0.7, 0.7 + random() * 0.5);
        island.rotation.y = random() * 6.28;
        for (let j = 0; j < 1 + Math.floor(random() * 4); j++) {
          const palm = createPalm(7 + random() * 7, 1 + random() * 2, random() * 6.28);
          palm.position.set(x + (random() - 0.5) * 12, 2, z + (random() - 0.5) * 12);
          group.add(palm);
        }
        if (i % 144 === 0) {
          const rock = outlined(new T.IcosahedronGeometry(6, 0), 0x766784);
          rock.position.set(x + 8, 4, z);
          rock.scale.set(1, 1.4, 0.7);
          group.add(rock);
        }
      } else if (track.id === 'harbor') {
        box(group, 25, 3, 25, x, 0, z, track.accent);
        track.obstacles.push({ x, z, radius: 17 });
        const height = 10 + random() * 30;
        box(group, 12, height, 14, x, height / 2 + 1, z, track.accent);
        if (i % 144 === 0) {
          const crane = new T.Group();
          crane.position.set(x, 0, z);
          group.add(crane);
          box(crane, 1.2, 52, 1.2, 0, 26, 0, 0xffbc57);
          box(crane, 45, 1.2, 1.2, 8, 51, 0, 0xffbc57);
          box(crane, 0.13, 20, 0.13, 28, 41, 0, 0xffbc57);
        }
      } else {
        const platform = outlined(new T.CylinderGeometry(6, 8, 4, 8), track.accent);
        platform.position.set(x, 1, z);
        group.add(platform);
        track.obstacles.push({ x, z, radius: 8 });
        const pole = new T.Mesh(new T.CylinderGeometry(0.6, 1.4, 65, 7), dark);
        pole.position.set(x, 33, z);
        group.add(pole);
        const rotor = new T.Group();
        rotor.position.set(x, 65, z);
        group.add(rotor);
        turbines.push(rotor);
        for (let k = 0; k < 3; k++) {
          const arm = new T.Group();
          arm.rotation.z = (k * Math.PI * 2) / 3;
          box(arm, 1.4, 25, 0.6, 0, 12, 0, track.accent);
          rotor.add(arm);
        }
      }
    }
  }
  // Skyline and angular mountains frame the course, well beyond the racing water.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2,
      radius = 650 + random() * 350,
      x = 220 + Math.cos(a) * radius,
      z = Math.sin(a) * radius;
    if (track.id === 'storm') {
      const geo = new T.ConeGeometry(110 + random() * 150, 100 + random() * 170, 4);
      const mountain = outlined(geo, 0x43677b);
      mountain.position.set(x, 40, z);
      group.add(mountain);
    } else {
      const h = 35 + random() * 150,
        w = 18 + random() * 30;
      const tower = new T.Group();
      tower.position.set(x, 0, z);
      tower.rotation.y = random() * 0.8;
      group.add(tower);
      if (i % 3 === 0) {
        box(tower, w * 1.6, h * 0.35, w * 1.1, 0, h * 0.175, 0, track.accent);
        box(tower, w, h * 0.45, w * 0.8, 0, h * 0.575, 0, track.accent);
        const crown = outlined(new T.ConeGeometry(w * 0.65, h * 0.3, 4), track.accent);
        crown.position.y = h * 0.95;
        tower.add(crown);
      } else if (i % 3 === 1) {
        const body = outlined(new T.CylinderGeometry(w * 0.45, w * 0.65, h, 6), track.accent);
        body.position.y = h / 2;
        tower.add(body);
        box(tower, 1, h * 0.3, 1, 0, h * 1.15, 0, track.accent, glowing(track.accent));
      } else box(tower, w, h, w * 0.65, 0, h / 2, 0, track.accent);
      for (let y = 12; i % 3 === 2 && y < h; y += 18)
        box(group, w + 0.2, 0.2, w + 0.2, x, y, z, track.accent, glowing(track.accent, 0.6));
    }
  }
  // Sparse stars, seeded so course switching is stable.
  const stars = new Float32Array(450 * 3);
  for (let i = 0; i < 450; i++) {
    const a = random() * Math.PI * 2,
      e = 0.15 + random() * 1.25;
    stars.set(
      [Math.cos(a) * Math.cos(e) * 2500, Math.sin(e) * 2500, Math.sin(a) * Math.cos(e) * 2500],
      i * 3,
    );
  }
  const starGeo = new T.BufferGeometry();
  starGeo.setAttribute('position', new T.BufferAttribute(stars, 3));
  group.add(
    new T.Points(
      starGeo,
      new T.PointsMaterial({ color: 0xaab9d4, size: 2.1, sizeAttenuation: true }),
    ),
  );
  addLandmarks(group, track);
  const musicVisuals = createMusicVisuals(track);
  group.add(musicVisuals.group);
  const dolphins = createDolphins(track);
  group.add(dolphins.group);
  batchStatic(group, [water, ...gates, ...turbines, dolphins.group, musicVisuals.group]);
  const pulseMaterials = new Map<T.MeshStandardMaterial, number>();
  const outlines = new Map<T.LineBasicMaterial, { color: T.Color; opacity: number }>();
  group.traverse((object) => {
    if (object instanceof T.LineSegments && object.material instanceof T.LineBasicMaterial)
      outlines.set(object.material, {
        color: object.material.color.clone(),
        opacity: object.material.opacity,
      });
    if (
      object instanceof T.Mesh &&
      object.material instanceof T.MeshStandardMaterial &&
      object.material.emissiveIntensity > 0 &&
      object.material.emissive.getHex() !== 0
    )
      pulseMaterials.set(object.material, object.material.emissiveIntensity);
  });
  return {
    group,
    water,
    waterMaterial,
    gates,
    turbines,
    update(t, player, bands = { low: 0, mid: 0, high: 0 }) {
      musicVisuals.update(bands);
      const outlinePulse = Math.min(1, bands.low * 0.75 + bands.mid * 0.2 + bands.high * 0.15);
      outlines.forEach((base, material) => {
        material.color.copy(base.color).multiplyScalar(1 + outlinePulse * 2.5);
        material.opacity = base.opacity + (1 - base.opacity) * outlinePulse;
      });
      pulseMaterials.forEach(
        (base, material) =>
          (material.emissiveIntensity = base * (1 + bands.low * 0.5 + bands.high * 0.15)),
      );
      sun.scale.setScalar(1 + bands.low * 0.035);
      waterMaterial.uniforms.uMusic.value.set(bands.low, bands.mid, bands.high);
      dolphins.update(t, player);
      waterMaterial.uniforms.uTime.value = t;
      water.position.x = Math.floor(player.x / CELL) * CELL;
      water.position.z = Math.floor(player.z / CELL) * CELL;
      gates.forEach((g, i) => {
        const p = track.gates[i];
        g.position.y = i === 0 ? 0 : waterHeight(p.x, p.z, t, track.wave);
        g.getObjectByName('next')!.visible = i === player.nextGate;
      });
      turbines.forEach((r, i) => (r.rotation.z = t * 0.3 + i));
    },
    dispose() {
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      group.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.LineSegments || o instanceof T.Points) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            if (m !== dark) materials.add(m);
          });
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
