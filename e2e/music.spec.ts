import { test, expect } from '@playwright/test';
test('plays all soundtrack files, analyses their spectrum, and mutes cleanly', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('#sound').click();
  const audio = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __vectide: {
              audio: {
                song: string;
                playing: boolean;
                time: number;
                bands: { low: number };
                error: string;
              };
            };
          }
        ).__vectide.audio,
    );
  await expect.poll(async () => (await audio()).playing).toBe(true);
  expect((await audio()).song).toBe('Before the First Credit');
  for (let i = 0; i < 4; i++) {
    await page.locator('#soundtrack-label').click();
    await page.locator(`[data-song="${i}"]`).click();
    expect((await audio()).song).toBe('Before the First Credit');
    await page.locator('#start').click();
    await expect
      .poll(
        async () => {
          const s = await audio();
          return s.playing && s.time > 0.3 && s.bands.low > 0.05;
        },
        { timeout: 15000 },
      )
      .toBe(true);
    expect((await audio()).error).toBe('');
    expect((await audio()).song).toBe(
      ['Apex Run', 'Crimson Slipstream', 'Neon Slipway', 'Horizon Lane'][i],
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'BACK TO COURSES' }).click();
    await expect.poll(async () => (await audio()).song).toBe('Before the First Credit');
  }
  await page.locator('#sound').click();
  await expect.poll(async () => (await audio()).playing).toBe(false);
  await expect.poll(async () => (await audio()).bands.low, { timeout: 10000 }).toBeLessThan(0.01);
});
