import * as T from 'three';
import type { Track } from './tracks';
import { waveGLSL } from './water';

export function createWaterMaterial(track: Track): T.ShaderMaterial {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
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
      ${waveGLSL}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        world.y = heightAt(world.xz) * uAmplitude;
        vWorld = world.xyz;
        vHeight = world.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uIntro;
      uniform vec3 uMusic;
      uniform vec3 base;
      uniform vec3 horizon;
      uniform float uTime;
      uniform float uAmplitude;
      varying vec3 vWorld;
      varying float vHeight;
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
        vec3 deep=base*.5+vec3(.005,.025,.045);
        vec3 shallow=vec3(.025,.34,.34);
        vec3 color=mix(deep,shallow,crest*.65+broadNoise*.12);
        float facing=max(dot(normal,normalize(vec3(-.3,1.,.5))),0.);
        color*=.52+facing*.66;
        float fresnel=pow(1.-max(dot(normal,viewDir),0.),3.);
        vec3 reflection=mix(vec3(.025,.09,.16),horizon*.48,.5+normal.z*.5);
        color=mix(color,reflection,fresnel*.55);
        vec3 halfDirection=normalize(viewDir+normalize(vec3(.65,.5,.35)));
        float specular=pow(max(dot(normal,halfDirection),0.),55.);
        color+=vec3(.66,.91,.87)*specular*.8;
        // Broken, moving foam follows crests rather than painting every polygon edge.
        float breaking=smoothstep(.57,.92,vHeight/uAmplitude);
        float foam=breaking*smoothstep(.38,.68,broadNoise*.55+ripples*.45);
        color=mix(color,vec3(.53,.83,.77),foam*.85);
        color=mix(color,horizon*.23,1.-exp(-distanceToCamera*.0008));
        // Music catches the actual crests and facets; no separate moving overlay.
        float nearField=1.-smoothstep(65.,135.,distanceToCamera);
        float crestLight=pow(crest,6.)*(.2+foam*.8);
        color+=vec3(.045,.34,.26)*crestLight*uMusic.x*nearField;
        color+=vec3(.025,.09,.12)*foam*uMusic.y*nearField;
        color+=vec3(.15,.24,.28)*uMusic.z*specular*nearField;
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
