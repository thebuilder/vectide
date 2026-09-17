import { expect, test } from '@playwright/test';
import type { HandlingSample } from './fixtures/handling';

test('keyboard weight shifts change flight through the running engine', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/fixtures/handling.html');
  await page.waitForFunction(() => !!window.handlingTest);
  const results: HandlingSample[] = [];
  for (const key of ['c', '', 'Shift']) {
    await page.evaluate(() => window.handlingTest.setup('flight'));
    await page.keyboard.down('w');
    if (key) await page.keyboard.down(key);
    results.push(await page.evaluate(() => window.handlingTest.run(0.65)));
    if (key) await page.keyboard.up(key);
    await page.keyboard.up('w');
  }
  const [forward, neutral, back] = results;
  expect(forward.lean).toBeLessThan(-0.9);
  expect(neutral.lean).toBe(0);
  expect(back.lean).toBeGreaterThan(0.9);
  expect(forward.y).toBeLessThan(neutral.y - 0.3);
  expect(back.y).toBeGreaterThan(neutral.y + 0.2);
  expect(forward.pitch).toBeLessThan(-0.3);
  expect(back.pitch).toBeGreaterThan(0.3);
  for (const result of results) {
    expect(result.time).toBeGreaterThanOrEqual(0.65);
    expect(result.z).toBeGreaterThan(10);
    expect(result.armed).toBe(false);
  }
  expect(errors).toEqual([]);
});
