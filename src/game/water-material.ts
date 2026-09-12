import * as T from 'three';
import type { Track } from './tracks';
import { MusicWater, musicWaterGLSL } from './music-water';
import { MAX_WATER_PULSES, pulseGLSL, pulseUniformsGLSL } from './water-pulses';
import { waterGLSL, type WaterProfile } from './water';

export function createWaterMaterial(track: Track, music = new MusicWater()): T.ShaderMaterial {
  return new T.ShaderMaterial({
    uniforms: {
      ...music.uniforms,
      uTime: { value: 0 },
      uPulseCount: { value: 0 },
      uPulses: { value: Array.from({ length: MAX_WATER_PULSES }, () => new T.Vector4()) },
      uPulseKinds: { value: new Float32Array(MAX_WATER_PULSES) },
      uIntro: { value: 1 },
      uMusic: { value: new T.Vector3() },
      uAmplitude: { value: track.wave },
      base: { value: new T.Color(track.water) },
      horizon: { value: new T.Color(track.horizon) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uAmplitude;
      varying vec3 vWorld;
      varying float vHeight;
      varying float vPulse;
      ${waterGLSL(track)}
      ${pulseGLSL}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        vPulse = pulseHeightAt(world.xz);
        world.y = heightAt(world.xz) * uAmplitude + vPulse;
        vWorld = world.xyz;
        vHeight = world.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      ${pulseUniformsGLSL}
      ${musicWaterGLSL}
      uniform float uIntro;
      uniform vec3 uMusic;
      uniform vec3 base;
      uniform vec3 horizon;
      uniform float uTime;
      uniform float uAmplitude;
      varying vec3 vWorld;
      varying float vHeight;
      varying float vPulse;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      void main() {
        // The polygon normals describe the real displaced surface. No grid or tile outlines.
        vec3 normal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
        if(normal.y<0.) normal=-normal;
        vec3 viewDir=normalize(cameraPosition-vWorld);
        float distanceToCamera=length(cameraPosition-vWorld);
        float crest=clamp(vHeight/uAmplitude*.5+.5,0.,1.);
        float broadNoise=noise(vWorld.xz*.065+vec2(uTime*.035,-uTime*.08));
        float ripples=noise(vWorld.xz*.4+vec2(uTime*.17,uTime*.08));
        vec3 deep=base*.45+vec3(.002,.008,.013);
        vec3 shallow=vec3(.008,.15,.145);
        vec3 color=mix(deep,shallow,crest*.52+broadNoise*.08);
        float facing=max(dot(normal,normalize(vec3(-.3,1.,.5))),0.);
        color*=.52+facing*.66;
        float fresnel=pow(1.-max(dot(normal,viewDir),0.),3.);
        vec3 reflection=mix(vec3(.025,.09,.16),horizon*.48,.5+normal.z*.5);
        color=mix(color,reflection,fresnel*.55);
        vec3 halfDirection=normalize(viewDir+normalize(vec3(.65,.5,.35)));
        float specular=pow(max(dot(normal,halfDirection),0.),110.);
        color+=vec3(.66,.91,.87)*specular*.23;
        // Broken, moving foam follows crests rather than painting every polygon edge.
        float breaking=max(smoothstep(.82,1.16,vHeight/uAmplitude),smoothstep(.3,1.8,vPulse));
        float foam=breaking*smoothstep(.52,.77,broadNoise*.55+ripples*.45);
        color=mix(color,vec3(.16,.44,.38),foam*.42);
        color=mix(color,horizon*.23,1.-exp(-distanceToCamera*.0008));
        // Bass lights existing swells; mids color the wave faces and treble catches foam.
        float nearField=1.-smoothstep(65.,135.,distanceToCamera);
        if(nearField>0.) {
          float ridge=pow(smoothstep(.42,.96,crest),2.);
          float detail=crestDetail(vWorld.xz);
          float bassLight=(uMusic.x*.24+uMusicBeat*.76)*ridge*detail;
          color+=vec3(.018,.34,.255)*bassLight*nearField;
          float face=smoothstep(.28,.62,crest)*(1.-smoothstep(.7,1.,crest));
          color+=vec3(.032,.055,.12)*uMusic.y*face*nearField;
          color+=vec3(.18,.28,.27)*uMusic.z*(foam*.6+specular*.35)*nearField;
        }
        // Weapon light lands on the ocean's displaced facets, including crests and troughs.
        for(int i=0;i<${MAX_WATER_PULSES};i++) {
          if(i>=uPulseCount) break;
          float kind=uPulseKinds[i];
          if(kind>4.5) continue;
          vec4 effect=uPulses[i];
          vec2 offset=vWorld.xz-effect.xy;
          if(dot(offset,offset)>900.) continue;
          float distance=length(offset);
          float age=effect.w;
          float glow=0.;
          if(kind<3.5) {
            bool mine=kind>2.5;
            float deploy=smoothstep(0.,.55,age);
            float radius=mine?mix(2.,7.,deploy):5.5;
            float halo=1.-smoothstep(0.,radius,distance);
            float core=1.-smoothstep(0.,1.8,distance);
            float power=mine ? .38+uMusic.x*1.35 : 1.;
            float fade=mine ? deploy*(1.-smoothstep(16.,18.,age)) : 1.;
            glow=(halo*halo*.75+core*.8)*power*fade;
          } else if(age>=0. && age<1.1) {
            float flash=(1.-smoothstep(0.,.32,age))*(1.-smoothstep(0.,12.,distance));
            float ring=(1.-smoothstep(.4,2.8,abs(distance-age*23.)))*(1.-smoothstep(.35,1.1,age));
            glow=flash*2.5+ring*1.2;
          }
          color+=vec3(1.8,.012,.035)*glow*(.65+normal.y*.35);
        }
        // The grid uses the same world-space cells and displaced vertices as the ocean.
        if(uIntro<1.){
          vec2 cell=vWorld.xz/4.;
          vec2 edge=abs(fract(cell-.5)-.5)/max(fwidth(cell),vec2(.0001));
          float grid=1.-smoothstep(.45,1.3,min(edge.x,edge.y));
          float distanceFade=1.-smoothstep(120.,650.,distanceToCamera);
          float sheet=smoothstep(0.,.18,uIntro);
          float fill=smoothstep(.25,.7,uIntro-distanceToCamera*.0002);
          vec3 wire=mix(vec3(.003,.009,.017),vec3(.09,.56,.44),grid*distanceFade*sheet*.65);
          color=mix(wire,color,fill);
        }
        gl_FragColor=vec4(color,1.);
      }`,
  });
}

export function updateWaterPulses(material: T.ShaderMaterial, profile: WaterProfile, time: number) {
  const pulses = (profile.pulses ?? []).slice(0, MAX_WATER_PULSES);
  material.uniforms.uPulseCount.value = pulses.length;
  pulses.forEach((p, i) => {
    material.uniforms.uPulses.value[i].set(
      p.x,
      p.z,
      p.yaw,
      p.age + time - (profile.pulseTime ?? time),
    );
    material.uniforms.uPulseKinds.value[i] = p.kind;
  });
}
