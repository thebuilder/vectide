import * as T from 'three';
import type { World } from './visuals';
/** One wire batch; moving model ranges track their live transforms during the reveal. */
export class ScanIntro {
  private elapsed = 0;
  private moving: { mesh: T.Mesh; local: T.BufferAttribute; offset: number }[] = [];
  private positions?: T.Float32BufferAttribute;
  private point = new T.Vector3();
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
    return Math.min(1, this.elapsed / 4.6);
  }
  get cageCount() {
    return this.cages.length;
  }
  constructor(
    scene: T.Scene,
    reduced: boolean,
    private world: World,
    movingRoots: T.Object3D[] = [],
  ) {
    if (reduced) {
      this.active = false;
      this.enabled.value = 0;
      return;
    }
    world.waterMaterial.uniforms.uIntro.value = 0;
    scene.updateMatrixWorld(true);
    const meshes: T.Mesh[] = [];
    scene.traverseVisible((o) => {
      if (
        o instanceof T.Mesh &&
        !(o instanceof T.InstancedMesh) &&
        o.material instanceof T.MeshStandardMaterial
      )
        meshes.push(o);
    });
    const movingMeshes = new Set<T.Object3D>();
    movingRoots.forEach((root) => root.traverse((mesh) => movingMeshes.add(mesh)));
    const bounds = new T.Box3();
    const positions: number[] = [];
    const edgeCache = new Map<T.BufferGeometry, T.EdgesGeometry>();
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
              '#include <clipping_planes_fragment>\nfloat scanDistance=distance(vIntroWorld,uIntroOrigin)+0.;float coverage=1.-smoothstep(uIntroRadius-280.,uIntroRadius-80.,scanDistance);float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(uIntroEnabled>.5&&coverage<dither)discard;',
            );
        };
        material.customProgramCacheKey = () => 'vectide-intro';
        material.needsUpdate = true;
      }
      let edges = edgeCache.get(mesh.geometry);
      if (!edges) {
        edges = new T.EdgesGeometry(mesh.geometry, 25);
        edgeCache.set(mesh.geometry, edges);
      }
      const points = edges.getAttribute('position');
      if (movingMeshes.has(mesh))
        this.moving.push({
          mesh,
          local: points.clone() as T.BufferAttribute,
          offset: positions.length / 3,
        });
      const point = new T.Vector3();
      for (let i = 0; i < points.count; i++) {
        point.fromBufferAttribute(points, i).applyMatrix4(mesh.matrixWorld);
        positions.push(point.x, point.y, point.z);
      }
    }
    for (const edges of edgeCache.values()) edges.dispose();
    const geometry = new T.BufferGeometry();
    this.positions = new T.Float32BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('position', this.positions);
    const wire = new T.LineSegments(
      geometry,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: { uRadius: this.radius, uOpacity: this.opacity, uOrigin: this.origin },
        vertexShader:
          'varying vec3 world;void main(){world=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}',
        fragmentShader:
          'varying vec3 world;uniform float uRadius;uniform float uOpacity;uniform vec3 uOrigin;void main(){float d=distance(world,uOrigin);float reveal=1.-smoothstep(uRadius-50.,uRadius+100.,d);float trail=smoothstep(uRadius-380.,uRadius-30.,d);float a=reveal*trail*uOpacity;if(a<.005)discard;gl_FragColor=vec4(.36,.9,.76,a);}',
      }),
    );
    wire.frustumCulled = false;
    scene.add(wire);
    this.cages.push(wire);
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
    // Physics and rider articulation have already run; include every parent transform.
    if (this.positions && this.moving.length) {
      this.positions.clearUpdateRanges();
      for (const { mesh, local, offset } of this.moving) {
        mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < local.count; i++) {
          this.point.fromBufferAttribute(local, i).applyMatrix4(mesh.matrixWorld);
          this.positions.setXYZ(offset + i, this.point.x, this.point.y, this.point.z);
        }
        this.positions.addUpdateRange(offset * 3, local.count * 3);
      }
      this.positions.needsUpdate = true;
    }
    this.elapsed += dt;
    const p = this.progress;
    this.world.waterMaterial.uniforms.uIntro.value = p;
    const scan = T.MathUtils.smoothstep(p, 0.12, 0.88);
    this.radius.value = scan * this.reach;
    this.opacity.value = Math.min(1, p / 0.06) * (1 - T.MathUtils.smoothstep(p, 0.72, 1));
    if (p === 1) this.finish();
  }
  finish() {
    this.active = false;
    this.enabled.value = 0;
    this.world.waterMaterial.uniforms.uIntro.value = 1;
    for (const cage of this.cages) {
      cage.removeFromParent();
      cage.geometry.dispose();
      (cage.material as T.Material).dispose();
    }
    this.cages = [];
    this.moving = [];
    this.positions = undefined;
    for (const [material, original] of this.materials) {
      material.onBeforeCompile = original.compile;
      material.customProgramCacheKey = original.cacheKey;
      material.needsUpdate = true;
    }
    this.materials.clear();
  }
}
