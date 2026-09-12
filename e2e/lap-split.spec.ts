import { expect, test } from '@playwright/test';

test('lap splits enter, show signed color comparisons, and fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine = engine;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
  const split = page.locator('#lap-split');
  const show = (laps: number[]) =>
    page.evaluate((laps) => {
      const e = (window as any).__testEngine;
      e.state = 'racing';
      e.player.laps = laps;
      e.onUpdate(e.snapshot());
      const style = getComputedStyle(document.getElementById('lap-split')!);
      return { opacity: Number(style.opacity), transform: style.transform };
    }, laps);
  const hide = async () => {
    await page.evaluate(() => {
      const e = (window as any).__testEngine;
      e.state = 'paused';
      e.onUpdate(e.snapshot());
    });
    await expect(split).toBeHidden();
  };
  const entrance = await show([60]);
  expect(entrance.opacity).toBeLessThan(1);
  await expect(split).toHaveCSS('opacity', '1');
  await expect(split.locator('.lap-split-time')).toHaveText('01:00.000');
  await expect(split.locator('.lap-split-delta')).toHaveCount(0);
  await expect(split).not.toContainText('·');
  await hide();
  await show([60, 58.5]);
  await expect(split).toHaveCSS('opacity', '1');
  await expect(split.locator('.lap-split-delta')).toHaveText('−1.50sFASTER');
  await expect(split.locator('.lap-split-delta')).toHaveCSS('color', 'rgb(129, 246, 166)');
  const box = await split.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(16);
  expect(box!.x + box!.width).toBeLessThanOrEqual(374);
  await page.screenshot({ path: 'artifacts/lap-split-faster.png' });
  await hide();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await show([60, 58.5, 60.75]);
  await expect(split).toHaveCSS('opacity', '1');
  await expect(split.locator('.lap-split-delta')).toHaveText('+2.25sSLOWER');
  await expect(split.locator('.lap-split-delta')).toHaveCSS('color', 'rgb(255, 122, 134)');
  expect(await split.evaluate((el) => getComputedStyle(el).transitionProperty)).not.toContain(
    'transform',
  );
  await page.screenshot({ path: 'artifacts/lap-split-slower.png' });
  await hide();
  await show([60, 58.5, 60.75, 60.751]);
  await expect(split.locator('.lap-split-delta')).toHaveText('±0.00sEVEN');
  await expect(split).toBeHidden({ timeout: 5000 });
});
