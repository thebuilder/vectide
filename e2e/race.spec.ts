import { test, expect } from '@playwright/test';

test('select courses, ride, pause, recover and restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /PORT AFTERDARK/ }).click();
  await expect(page.locator('#description')).toContainText('docks');
  await page.getByRole('button', { name: /STORM SIGNAL/ }).click();
  await expect(page.locator('#description')).toContainText('Heavy swell');
  await page.getByRole('button', { name: /PALM CIRCUIT/ }).click();
  await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.getByRole('button', { name: 'HIT THE WATER' }).click();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 10000 });
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await page.locator('#speed').innerText()), { timeout: 10000 })
    .toBeGreaterThan(15);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  const time = await page.locator('#timer').innerText();
  await page.waitForTimeout(250);
  await expect(page.locator('#timer')).toHaveText(time);
  await page.getByRole('button', { name: 'KEEP RIDING' }).click();
  await expect(page.locator('#pause-dialog')).toBeHidden();
  await page.keyboard.press('r');
  await expect(page.locator('#notice')).toBeEmpty();
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await page.locator('#speed').innerText()), { timeout: 5000 })
    .toBeGreaterThan(15);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'RESTART RACE' }).click();
  await expect(page.locator('#timer')).toHaveText('00:00.000');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'BACK TO COURSES' }).click();
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('rider joints stay connected while absorbing rough water and turning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /STORM SIGNAL/ }).click();
  await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.getByRole('button', { name: 'HIT THE WATER' }).click();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 10000 });
  await page.keyboard.down('w');
  let minimum = 1,
    maximum = 0;
  for (let i = 0; i < 35; i++) {
    if (i === 12) await page.keyboard.down('a');
    if (i === 22) await page.keyboard.up('a');
    const pose = await page.evaluate(() => {
      const state = (
        window as unknown as {
          __vectide: { rider: { compression: number; handErrors: number[]; footErrors: number[] } };
        }
      ).__vectide;
      return state.rider;
    });
    expect(Math.max(...pose.handErrors)).toBeLessThan(0.015);
    expect(Math.max(...pose.footErrors)).toBeLessThan(0.015);
    minimum = Math.min(minimum, pose.compression);
    maximum = Math.max(maximum, pose.compression);
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('w');
  expect(maximum - minimum).toBeGreaterThan(0.04);
});

test('player stays centered and points through the start line during countdown', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const alignment = await page.evaluate(() => {
      const s = (
        window as unknown as {
          __vectide: {
            player: { x: number; z: number; yaw: number };
            track: { gates: { x: number; z: number; tx: number; tz: number }[] };
          };
        }
      ).__vectide;
      const p = s.player,
        g = s.track.gates[0],
        dx = g.x - p.x,
        dz = g.z - p.z;
      return {
        lateral: -dx * g.tz + dz * g.tx,
        heading: Math.sin(p.yaw) * g.tx + Math.cos(p.yaw) * g.tz,
      };
    });
    expect(Math.abs(alignment.lateral)).toBeLessThan(0.001);
    expect(alignment.heading).toBeCloseTo(1, 5);
    await page.waitForTimeout(200);
  }
});

test('coasting settles to zero speed and stays stopped', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 15000 });
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await page.locator('#speed').innerText()), { timeout: 10000 })
    .toBeGreaterThan(25);
  await page.keyboard.up('w');
  await expect(page.locator('#speed')).toHaveText('0', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await expect(page.locator('#speed')).toHaveText('0');
});

test('Shift visibly leans the rider back while hands and feet stay attached', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 15000 });
  const pose = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __vectide: { rider: { forward: number; handErrors: number[]; footErrors: number[] } };
          }
        ).__vectide.rider,
    );
  const before = (await pose()).forward;
  await page.keyboard.down('Shift');
  await expect
    .poll(async () => (await pose()).forward, { timeout: 5000 })
    .toBeLessThan(before - 0.15);
  const leaning = await pose();
  expect(Math.max(...leaning.handErrors, ...leaning.footErrors)).toBeLessThan(0.015);
  await page.keyboard.up('Shift');
});
