import { expect, test } from '@playwright/test';
test('renders low islands, grounded palms and moving coastal surf without errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/e2e/fixtures/coast.html');
  await page.waitForFunction(() => typeof (window as any).inspectCoast === 'function');
  for (const low of [false, true]) {
    await page.evaluate((low) => (window as any).inspectCoast(0, 0, low), low);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `artifacts/island-${low ? 'waterline' : 'overview'}.png` });
  }
  const memory = await page.evaluate(() => {
    const e = (window as any).demo;
    return {
      textures: e.renderer.info.memory.textures,
    };
  });
  for (let i = 0; i < 4; i++) {
    await page.evaluate((i) => (window as any).inspectCoast(i % 3, 0), i);
    await page.waitForTimeout(50);
  }
  const after = await page.evaluate(() => {
    const e = (window as any).demo;
    return {
      textures: e.renderer.info.memory.textures,
    };
  });
  expect(after.textures).toBe(memory.textures);
  expect(errors).toEqual([]);
});
