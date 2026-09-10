import { test, expect } from '@playwright/test';
import type { Snapshot } from '../src/game/engine';
test('intro stages the interface and releases the race', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('.hero')).not.toHaveClass(/intro-visible/);
  await expect(page.locator('.home-actions')).toHaveJSProperty('inert', true);
  await expect(page.locator('.home-actions')).toHaveJSProperty('inert', false);
  await expect(page.locator('.hero')).toHaveClass(/intro-visible/);
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toBeVisible();
  // Leaving the offshore title scene must restore the actual race grid.
  expect(
    await page.evaluate(() => {
      const { player, track } = (window as unknown as { __vectide: Snapshot }).__vectide;
      return Math.hypot(player.x - track.gates[0].x, player.z - track.gates[0].z);
    }),
  ).toBeLessThan(30);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __vectide: { intro: { active: boolean; cages: number } } })
          .__vectide.intro,
    ),
  ).toMatchObject({ active: false, cages: 0 });
  expect(errors).toEqual([]);
});
test('reduced motion shows the complete menu immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.home-actions')).toHaveJSProperty('inert', false);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __vectide: { intro: { active: boolean; cages: number } } })
          .__vectide.intro,
    ),
  ).toMatchObject({ active: false, cages: 0 });
});
