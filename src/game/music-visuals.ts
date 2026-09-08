import * as T from 'three';
import type { Spectrum } from './spectrum';
import type { Track } from './tracks';
/** Distant illuminated columns are decorative; they never alter the racing corridor. */
export function createMusicVisuals(track: Track) {
  const group = new T.Group(),
    bars: T.Mesh[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2,
      radius = 540;
    const material = new T.MeshStandardMaterial({
      color: track.accent,
      emissive: track.accent,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const bar = new T.Mesh(new T.BoxGeometry(5, 1, 5), material);
    bar.position.set(Math.cos(a) * radius + 100, 0, Math.sin(a) * radius);
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
