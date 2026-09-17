import { expect, test } from '@playwright/test';
import type {} from './fixtures/handling';

test('Space and steering slide the stern; releasing Space restores grip', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/fixtures/handling.html');
  await page.waitForFunction(() => !!window.handlingTest);
  await page.evaluate(() => window.handlingTest.setup('drift'));
  await page.keyboard.down('Space');
  await page.keyboard.down('a');
  const slide = await page.evaluate(() => window.handlingTest.run(0.6));
  expect(slide.time).toBeGreaterThanOrEqual(0.6);
  expect(slide.z).toBeGreaterThan(5);
  expect(slide.speed).toBeGreaterThan(10);
  expect(slide.yaw).toBeGreaterThan(0.7);
  expect(slide.slip).toBeGreaterThan(0.6);
  await page.keyboard.up('Space');
  await page.keyboard.up('a');
  await page.keyboard.down('w');
  const exit = await page.evaluate(() => window.handlingTest.run(1));
  await page.keyboard.up('w');
  expect(exit.time).toBeGreaterThan(slide.time + 0.99);
  expect(exit.slip).toBeLessThan(slide.slip * 0.3);
  expect(exit.speed).toBeGreaterThan(slide.speed);
  expect(errors).toEqual([]);
});
