import { expect, test } from '@playwright/test';
test('coastal attenuation matches the GPU at the bank and through breaking surf', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => typeof (window as any).compareHeights === 'function');
  for (const time of [0, 1.3, 3.7, 7.2]) {
    const samples = await page.evaluate((time) => {
      const w = window as any,
        land = w.demo.track.land[0],
        points: number[][] = [];
      for (const p of land.outline)
        for (const scale of [0.8, 1, 1.08, 1.3, 1.8])
          points.push([land.x + (p.x - land.x) * scale, land.z + (p.z - land.z) * scale]);
      return w.compareHeights(points, time);
    }, time);
    expect(Math.max(...samples.map((s: any) => Math.abs(s.cpu - s.gpu)))).toBeLessThan(0.002);
  }
  expect(errors).toEqual([]);
});
