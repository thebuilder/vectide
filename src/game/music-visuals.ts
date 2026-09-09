import * as T from 'three';
import type { Spectrum } from './spectrum';
import type { Track } from './tracks';
/** Distant illuminated columns are decorative; they never alter the racing corridor. */
export function createMusicVisuals(track: Track, skyline: T.Box3[] = []) {
  const group = new T.Group(),
    bars: T.Mesh[] = [];
  group.name = 'Music spectrum';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const position = [540, 650, 760]
      .map((radius) => ({ x: Math.cos(a) * radius + 100, z: Math.sin(a) * radius }))
      .find(({ x, z }) => {
        const clearance = new T.Box3(
          new T.Vector3(x - 18, -10, z - 18),
          new T.Vector3(x + 18, 80, z + 18),
        );
        const nearLand = track.land.some((land) => {
          const bounds = new T.Box3().setFromPoints(
            land.outline.map((p) => new T.Vector3(p.x, 0, p.z)),
          );
          bounds.min.y = -10;
          bounds.max.y = 80;
          return bounds.expandByScalar(25).intersectsBox(clearance);
        });
        return (
          !nearLand &&
          !skyline.some((bounds) => bounds.intersectsBox(clearance)) &&
          !track.points.some((p) => Math.hypot(p.x - x, p.z - z) < 80)
        );
      });
    if (!position) continue;
    const { x, z } = position;
    const material = new T.MeshStandardMaterial({
      color: track.accent,
      emissive: track.accent,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const bar = new T.Mesh(new T.BoxGeometry(5, 1, 5), material);
    bar.position.set(x, 0, z);
    group.add(bar);
    bars.push(bar);
  }
  return {
    group,
    update(bands: Spectrum) {
      bars.forEach((bar, i) => {
        const level = i % 3 === 0 ? bands.low : i % 3 === 1 ? bands.mid : bands.high;
        const height = 5 + level * (18 + Math.sin(i * 2.1) ** 2 * 32);
        bar.scale.y = height;
        bar.position.y = height / 2;
        (bar.material as T.MeshStandardMaterial).emissiveIntensity = 0.35 + level * 0.9;
      });
    },
  };
}
