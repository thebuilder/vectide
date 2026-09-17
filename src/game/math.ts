export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const angle = (n: number) => Math.atan2(Math.sin(n), Math.cos(n));
