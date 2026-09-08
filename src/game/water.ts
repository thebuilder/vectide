// Fixed world-space grid. Physics interpolates the same two triangles as the GPU mesh.
export const CELL = 4;
export const WAVES = [
  { x: 0.92, z: 0.39, k: 0.105, s: 1.28, a: 0.72 },
  { x: -0.34, z: 0.94, k: 0.19, s: 1.74, a: 0.32 },
  { x: 0.71, z: -0.71, k: 0.36, s: 2.35, a: 0.13 },
];
export function vertexHeight(x: number, z: number, t: number, amplitude: number): number {
  let h = 0;
  for (const w of WAVES) h += Math.sin((x * w.x + z * w.z) * w.k - t * w.s) * w.a * amplitude;
  return h;
}
export function waterHeight(x: number, z: number, t: number, amplitude: number): number {
  const gx = Math.floor(x / CELL) * CELL,
    gz = Math.floor(z / CELL) * CELL;
  const u = (x - gx) / CELL,
    v = (z - gz) / CELL;
  const a = vertexHeight(gx, gz, t, amplitude),
    b = vertexHeight(gx + CELL, gz, t, amplitude);
  const c = vertexHeight(gx, gz + CELL, t, amplitude),
    d = vertexHeight(gx + CELL, gz + CELL, t, amplitude);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export const waveGLSL = `float heightAt(vec2 p) {return ${WAVES.map((w) => `sin(dot(p,vec2(${w.x},${w.z}))*${w.k}-uTime*${w.s})*${w.a}`).join('+')};}`;
