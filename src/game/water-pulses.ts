/** Weapon disturbances deform the same ocean grid used by buoyancy and rendering. */
export interface WaterPulse {
  kind: number;
  x: number;
  z: number;
  yaw: number;
  age: number;
}
export const MAX_WATER_PULSES = 32;
const smooth = (lo: number, hi: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
/** A wake builds at the stern before its curved front spreads backwards and sideways. */
export const wakeTravel = (age: number) => 20 * (age - 0.18 * (1 - Math.exp(-age / 0.18)));
export const wakeWidth = (age: number) => 3 + 20 * smooth(0, 0.45, age) + age * 3;
export const wakeFront = (along: number, side: number, age: number) =>
  along - wakeTravel(age) + (side * side) / (6 + wakeTravel(age));
export function pulseHeight(x: number, z: number, age: number, pulse: WaterPulse): number {
  if (pulse.kind < 4 || age < 0) return 0;
  const ring = pulse.kind === 4;
  const lifetime = ring ? 1.1 : 2;
  if (age >= lifetime) return 0;
  const dx = x - pulse.x,
    dz = z - pulse.z;
  // Cheap broad phase also keeps most ocean vertices out of the expensive crest calculation.
  if (dx * dx + dz * dz > 75 * 75) return 0;
  const side = ring ? 0 : dx * Math.cos(pulse.yaw) - dz * Math.sin(pulse.yaw);
  const along = ring
    ? Math.hypot(dx, dz) - age * 23
    : wakeFront(dx * Math.sin(pulse.yaw) + dz * Math.cos(pulse.yaw), side, age);
  if (Math.abs(along) > 24) return 0;
  const width = wakeWidth(age);
  const edge = ring ? 1 : 1 - smooth(width * 0.6, width, Math.abs(side));
  const life = smooth(0, ring ? 0.18 : 0.12, age) * (1 - smooth(lifetime * 0.55, lifetime, age));
  const crest = Math.exp(-((along / 5) ** 2)) - 0.28 * Math.exp(-(((along + 7) / 6) ** 2));
  return crest * edge * life * (ring ? 2.7 : 2.3);
}
// Keep the GLSL formula paired with the CPU function above. Browser tests compare both.
export const pulseUniformsGLSL = `
  uniform int uPulseCount;
  uniform vec4 uPulses[${MAX_WATER_PULSES}];
  uniform float uPulseKinds[${MAX_WATER_PULSES}];
`;
export const pulseGLSL = `${pulseUniformsGLSL}
  float pulseHeightAt(vec2 p) {
    float height=0.;
    for(int i=0;i<${MAX_WATER_PULSES};i++) {
      if(i>=uPulseCount) break;
      if(uPulseKinds[i]<4.) continue;
      vec4 pulse=uPulses[i];
      float age=pulse.w;
      bool ring=uPulseKinds[i]<4.5;
      float lifetime=ring?1.1:2.;
      if(age<0. || age>=lifetime) continue;
      vec2 offset=p-pulse.xy;
      if(dot(offset,offset)>5625.) continue;
      vec2 direction=vec2(sin(pulse.z),cos(pulse.z));
      float side=abs(dot(offset,vec2(direction.y,-direction.x)));
      float travel=20.*(age-.18*(1.-exp(-age/.18)));
      float along=ring?length(offset)-age*23.:dot(offset,direction)-travel+side*side/(6.+travel);
      if(abs(along)>24.) continue;
      float width=3.+20.*smoothstep(0.,.45,age)+age*3.;
      float edge=ring?1.:1.-smoothstep(width*.6,width,side);
      float life=smoothstep(0.,ring?.18:.12,age)*(1.-smoothstep(lifetime*.55,lifetime,age));
      float a=along/5., b=(along+7.)/6.;
      float crest=exp(-a*a)-.28*exp(-b*b);
      height+=crest*edge*life*(ring?2.7:2.3);
    }
    return clamp(height,-2.,5.);
  }
`;
