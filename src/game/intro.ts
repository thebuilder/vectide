import * as T from 'three';
/** Temporary world-space wire cages lead the solid reveal and are disposed at completion. */
export class ScanIntro {
  private elapsed = 0;
  private cages: T.LineSegments[] = [];
  private enabled = { value: 1 };
  private radius = { value: 0 };
  private opacity = { value: 0 };
  private origin = { value: new T.Vector3(-180, -40, 140) };
  private materials = new Map<
    T.Material,
    { compile: T.Material['onBeforeCompile']; cacheKey: T.Material['customProgramCacheKey'] }
  >();
  private reach = 1400;
  active = true;
  get progress() {
    return Math.min(1, this.elapsed / 3.4);
  }
  get cageCount() {
    return this.cages.length;
  }
  constructor(scene: T.Scene, reduced: boolean) {
    if (reduced) {
      this.active = false;
      this.enabled.value = 0;
      return;
    }
    scene.updateMatrixWorld(true);
    const meshes: T.Mesh[] = [];
    scene.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        !(o instanceof T.InstancedMesh) &&
        o.material instanceof T.MeshStandardMaterial
      )
        meshes.push(o);
    });
    const bounds = new T.Box3();
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox)
        bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
      const material = mesh.material as T.MeshStandardMaterial;
      if (!this.materials.has(material)) {
        this.materials.set(material, {
          compile: material.onBeforeCompile,
          cacheKey: material.customProgramCacheKey,
        });
        const previous = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          previous.call(material, shader, renderer);
          Object.assign(shader.uniforms, {
            uIntroEnabled: this.enabled,
            uIntroRadius: this.radius,
            uIntroOrigin: this.origin,
          });
          shader.vertexShader =
            'varying vec3 vIntroWorld;\n' +
            shader.vertexShader.replace(
              '#include <project_vertex>',
              '#include <project_vertex>\nvIntroWorld=(modelMatrix*vec4(transformed,1.)).xyz;',
            );
          shader.fragmentShader =
            'varying vec3 vIntroWorld;uniform float uIntroEnabled;uniform float uIntroRadius;uniform vec3 uIntroOrigin;\n' +
            shader.fragmentShader.replace(
              '#include <clipping_planes_fragment>',
              '#include <clipping_planes_fragment>\nfloat scanDistance=distance(vIntroWorld,uIntroOrigin)+sin(vIntroWorld.x*.007+vIntroWorld.y*.011)*36.+sin(vIntroWorld.z*.021)*17.;if(uIntroEnabled>.5&&scanDistance>uIntroRadius-100.)discard;',
            );
        };
        material.customProgramCacheKey = () => 'vectide-intro';
        material.needsUpdate = true;
      }
      const wire = new T.LineSegments(
        new T.EdgesGeometry(mesh.geometry, 25),
        new T.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          uniforms: { uRadius: this.radius, uOpacity: this.opacity, uOrigin: this.origin },
          vertexShader:
            'varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
          fragmentShader:
            'varying vec3 world;uniform float uRadius;uniform float uOpacity;uniform vec3 uOrigin;void main(){float d=distance(world,uOrigin)+sin(world.x*.007+world.y*.011)*36.+sin(world.z*.021)*17.;float rim=exp(-pow((d-uRadius)/85.,2.));float trail=smoothstep(uRadius-260.,uRadius,d)*(1.-smoothstep(uRadius,uRadius+30.,d));float a=(rim+trail*.35)*uOpacity;if(a<.01)discard;gl_FragColor=vec4(.48,1.,.86,a);}',
        }),
      );
      mesh.add(wire);
      this.cages.push(wire);
    }
    if (!bounds.isEmpty())
      this.reach =
        Math.max(
          bounds.min.distanceTo(this.origin.value),
          bounds.max.distanceTo(this.origin.value),
        ) +
        bounds.getSize(new T.Vector3()).length() * 0.3 +
        180;
  }
  update(dt: number) {
    if (!this.active || document.hidden) return;
    this.elapsed += Math.min(dt, 1 / 30);
    const p = this.progress;
    this.radius.value = (1 - Math.pow(1 - p, 1.35)) * this.reach;
    this.opacity.value = Math.min(1, p / 0.06) * (1 - T.MathUtils.smoothstep(p, 0.72, 1));
    if (p === 1) this.finish();
  }
  finish() {
    this.active = false;
    this.enabled.value = 0;
    for (const cage of this.cages) {
      cage.removeFromParent();
      cage.geometry.dispose();
      (cage.material as T.Material).dispose();
    }
    this.cages = [];
    for (const [material, original] of this.materials) {
      material.onBeforeCompile = original.compile;
      material.customProgramCacheKey = original.cacheKey;
      material.needsUpdate = true;
    }
    this.materials.clear();
  }
}
