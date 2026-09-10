import * as T from 'three';
import { MINE_TOSS_SECONDS, projectileHeight, type ItemEffect, type Pickups } from './pickups';
import { waterHeight } from './water';

/** Shared meshes and a bounded effect pool keep item rendering independent of simulation. */
export class PickupVisuals {
  readonly group = new T.Group();
  private boxes = new T.Group();
  private boxAnimations: { available: boolean; started: number; from: number; amount: number }[] =
    [];
  private previousTime = -Infinity;
  private effects = new Map<number, T.Group>();
  private source?: Pickups;
  private cube = new T.BoxGeometry(1.65, 1.65, 1.65);
  private cage = new T.OctahedronGeometry(1.65);
  private sphere = new T.IcosahedronGeometry(0.8, 0);
  private torpedo = new T.ConeGeometry(0.55, 3.5, 5).rotateX(Math.PI / 2);
  private mint = new T.MeshBasicMaterial({ color: '#86fadd', wireframe: true });
  private weapon = new T.MeshStandardMaterial({
    color: '#781326',
    emissive: '#ff1028',
    emissiveIntensity: 2.4,
    flatShading: true,
  });
  private mineBeacon = new T.MeshBasicMaterial({
    color: new T.Color(2.8, 0.015, 0.035),
    wireframe: true,
  });
  private up = new T.Vector3(0, 1, 0);
  private normal = new T.Vector3();
  onExplosion: (x: number, y: number, z: number) => void = () => {};
  onSplash: (x: number, y: number, z: number, strength: number) => void = () => {};
  private dark = new T.MeshBasicMaterial({ color: '#ffffff' });
  private texture: T.CanvasTexture;
  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#16484f';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#86fadd';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 60, 60);
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('?', 32, 34);
    this.texture = new T.CanvasTexture(canvas);
    this.texture.colorSpace = T.SRGBColorSpace;
    this.dark.map = this.texture;
    this.group.add(this.boxes);
  }
  update(
    items: Pickups,
    time: number,
    visible: boolean,
    bass = 0,
    reducedMotion = false,
    viewer?: { x: number; z: number },
  ) {
    this.group.visible = visible && items.enabled;
    if (!this.group.visible) return;
    if (this.source !== items || time < this.previousTime) {
      for (const [id, mesh] of this.effects) this.remove(id, mesh);
      this.source = items;
      this.clearBoxes();
      items.boxes.forEach((_, i) => {
        const box = new T.Group();
        box.add(new T.Mesh(this.cube, this.dark.clone()), new T.Mesh(this.cage, this.mint.clone()));
        this.boxes.add(box);
        const available = items.state.cooldowns[i] <= 0;
        this.boxAnimations.push({ available, started: time, from: 0, amount: 0 });
      });
    }
    this.previousTime = time;
    items.boxes.forEach((box, i) => {
      const mesh = this.boxes.children[i];
      const animation = this.boxAnimations[i],
        available = items.state.cooldowns[i] <= 0;
      if (available !== animation.available) {
        animation.available = available;
        animation.started = time;
        animation.from = animation.amount;
      }
      const progress = T.MathUtils.smoothstep(time - animation.started, 0, available ? 0.25 : 0.18);
      animation.amount = T.MathUtils.lerp(animation.from, available ? 1 : 0, progress);
      // Faraway rows must not look like a shortcut to a later part of the course.
      const proximity = viewer
        ? 1 - T.MathUtils.smoothstep(Math.hypot(box.x - viewer.x, box.z - viewer.z), 65, 100)
        : 1;
      mesh.visible = (available || animation.amount > 0) && proximity > 0;
      mesh.scale.setScalar(reducedMotion ? 1 : Math.max(0.001, animation.amount));
      mesh.rotation.y = !available && !reducedMotion ? progress * Math.PI * 2 : 0;
      for (const child of mesh.children) {
        const material = (child as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>).material;
        material.transparent = reducedMotion || proximity < 1;
        material.opacity = (reducedMotion ? animation.amount : 1) * proximity;
        material.depthWrite = material.opacity === 1;
      }
      mesh.position.set(
        box.x,
        waterHeight(box.x, box.z, time, items.surface) + 2 + Math.sin(time * 2 + i) * 0.22,
        box.z,
      );
      mesh.children[0].rotation.set(time * 0.25, time * 0.65, Math.PI / 4);
      mesh.children[1].rotation.y = -time * 0.4;
    });
    this.mineBeacon.color.setRGB(0.9 + bass * 3.2, 0.015, 0.035);
    const projectiles = items.state.effects;
    const ids = new Set(projectiles.map((e) => e.id));
    for (const [id, mesh] of this.effects) if (!ids.has(id)) this.remove(id, mesh);
    for (const effect of projectiles) {
      let mesh = this.effects.get(effect.id);
      if (mesh && mesh.userData.kind !== effect.kind) {
        this.remove(effect.id, mesh);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = this.create(effect);
        this.effects.set(effect.id, mesh);
        this.group.add(mesh);
        if (effect.kind === 4 && effect.age + time - items.waterTime < 0.35)
          this.onExplosion(
            effect.x,
            waterHeight(effect.x, effect.z, time, items.surface),
            effect.z,
          );
      }
      if (effect.kind === 5 && !mesh.userData.launched) {
        mesh.userData.launched = true;
        if (effect.age + time - items.waterTime < 0.15)
          this.onSplash(
            effect.x,
            waterHeight(effect.x, effect.z, time, items.surface),
            effect.z,
            0.3,
          );
      }
      this.position(mesh, effect, items, time);
    }
  }
  private create(e: ItemEffect) {
    const group = new T.Group();
    group.userData.kind = e.kind;
    if (e.kind <= 2) group.add(new T.Mesh(this.torpedo, this.weapon));
    else if (e.kind === 3) {
      group.add(new T.Mesh(this.sphere, this.weapon));
      const cage = new T.Mesh(this.cage, this.mineBeacon);
      cage.scale.setScalar(0.75);
      group.add(cage);
    } else if (e.kind === 4) {
      const material = new T.MeshBasicMaterial({
        color: new T.Color(3, 0.8, 0.35),
        transparent: true,
        depthWrite: false,
      });
      group.userData.material = material;
      group.add(new T.Mesh(this.sphere, material));
    }
    return group;
  }
  private position(group: T.Group, e: ItemEffect, items: Pickups, time: number) {
    const age = Math.max(0, e.age + time - items.waterTime);
    if (e.kind === 5) return;
    if (e.kind === 4) {
      group.position.set(e.x, waterHeight(e.x, e.z, time, items.surface) + 0.5, e.z);
      (group.userData.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 0.25);
      group.scale.setScalar(0.5 + age * 8);
      return;
    }
    group.position.set(e.x, projectileHeight(e, time, items.surface, age), e.z);
    group.rotation.set(0, e.yaw, 0);
    if (e.kind === 3) {
      const sample = (x: number, z: number) => waterHeight(x, z, time, items.surface);
      this.normal
        .set(
          sample(e.x - 1, e.z) - sample(e.x + 1, e.z),
          2,
          sample(e.x, e.z - 1) - sample(e.x, e.z + 1),
        )
        .normalize();
      group.quaternion.setFromUnitVectors(this.up, this.normal);
      group.children[1].rotation.y = time;
      const phase = e.launch ? Math.min(1, age / MINE_TOSS_SECONDS) : 1;
      const grow = phase * phase * (3 - 2 * phase);
      group.rotateX(Math.PI * 2 * grow);
      group.scale.setScalar((0.25 + grow * 0.75) * Math.max(0, 1 - Math.max(0, age - 16) / 2));
      if (e.launch && phase === 1 && !group.userData.landed) {
        group.userData.landed = true;
        if (age < MINE_TOSS_SECONDS + 0.25) this.onSplash(e.x, sample(e.x, e.z), e.z, 0.25);
      }
    }
  }
  private remove(id: number, group: T.Group) {
    (group.userData.material as T.Material | undefined)?.dispose();
    this.group.remove(group);
    this.effects.delete(id);
  }
  private clearBoxes() {
    for (const box of this.boxes.children)
      for (const child of box.children)
        (child as T.Mesh<T.BufferGeometry, T.Material>).material.dispose();
    this.boxes.clear();
    this.boxAnimations = [];
  }
  dispose() {
    this.clearBoxes();
    for (const [id, group] of this.effects) this.remove(id, group);
    [
      this.cube,
      this.cage,
      this.sphere,
      this.torpedo,
      this.mint,
      this.weapon,
      this.mineBeacon,
      this.dark,
    ].forEach((r) => r.dispose());
    this.texture.dispose();
  }
}
