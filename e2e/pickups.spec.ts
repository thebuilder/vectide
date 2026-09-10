import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../src/game/engine';
import type { Pickup, PickupState } from '../src/game/pickups';
type Diagnostics = Snapshot & { pickups: PickupState & { enabled: boolean; boxes: Pickup[] } };
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vectide: Diagnostics }).__vectide);
async function autopilot(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/game/physics.ts';
    const { aiInput } = await import(path);
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => {
        const s = (window as unknown as { __vectide: Diagnostics }).__vectide;
        const input = aiInput(s.player, s.track, s.racers, 'normal');
        const target = s.pickups.boxes
          .filter((b, i) => !s.pickups.cooldowns[i] && (i % 5 === 0 || i % 5 === 4))
          .map((b) => ({
            b,
            d: Math.hypot(b.x - s.player.x, b.z - s.player.z),
            angle: Math.atan2(b.x - s.player.x, b.z - s.player.z) - s.player.yaw,
          }))
          .filter((v) => v.d < 85 && Math.cos(v.angle) > 0.1)
          .sort((a, b) => a.d - b.d)[0];
        if (!s.player.item && target)
          input.steer = Math.max(
            -1,
            Math.min(1, Math.atan2(Math.sin(target.angle), Math.cos(target.angle)) * 2.5),
          );
        return [
          {
            connected: true,
            axes: [-input.steer, input.lean],
            buttons: Array.from({ length: 16 }, (_, i) => ({
              pressed: i === 7,
              value: i === 7 ? input.throttle : i === 6 ? input.brake : 0,
            })),
          },
        ];
      },
    });
  });
}
test('pickups toggle persists and time trials always exclude items', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await expect(page.locator('#pickups-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pickups-toggle').click();
  await page.locator('#start').click();
  expect((await state(page)).pickups.enabled).toBe(false);
  expect((await state(page)).pickups.boxes).toHaveLength(0);
  await expect(page.locator('#item-hud')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('#exit').click();
  await expect(page.locator('#pickups-toggle')).toHaveText('OFF');
  await page.locator('#pickups-toggle').click();
  await page.locator('[data-mode="trial"]').click();
  await expect(page.locator('#pickups-toggle')).toBeDisabled();
  await page.locator('#start').click();
  expect((await state(page)).pickups.enabled).toBe(false);
});
test('riding through a crate awards an item, Q uses it, and restart clears items', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  expect((await state(page)).pickups.boxes).toHaveLength(25);
  await expect(page.locator('#item-hud')).toBeHidden();
  await autopilot(page);
  await expect
    .poll(
      async () => {
        const s = await state(page),
          box = s.pickups.boxes[2];
        return Math.hypot(s.player.x - box.x, s.player.z - box.z);
      },
      { timeout: 60000 },
    )
    .toBeLessThan(70);
  await page.screenshot({ path: 'artifacts/pickups-approach.png' });
  await page.waitForFunction(
    () => (window as unknown as { __vectide: Diagnostics }).__vectide.player.item > 0,
    undefined,
    { timeout: 60000 },
  );
  await expect(page.locator('#item-hud')).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('#item-use')).toBeHidden();
  const revealHeight = await page.locator('#item-hud').evaluate((el) => el.clientHeight);
  await page.keyboard.down('q');
  await page.screenshot({ path: 'artifacts/pickups-revealing.png' });
  await expect(page.locator('#item-hud')).toHaveAttribute('data-ready', 'true');
  expect((await state(page)).player.item).toBeGreaterThan(0);
  await page.keyboard.up('q');
  await expect(page.locator('#item-announcement')).toContainText('ready');
  expect(await page.locator('#item-hud').evaluate((el) => el.clientHeight)).toBe(revealHeight);
  await expect(page.locator('#item-use .item-use-glitch')).toHaveCount(2);
  await page.screenshot({ path: 'artifacts/pickups-held.png' });
  const held = (await state(page)).player.item;
  await expect(page.locator('#item-name')).not.toHaveText('EMPTY');
  await page.keyboard.down('q');
  await expect.poll(async () => (await state(page)).player.item).toBe(0);
  await page.keyboard.up('q');
  await expect(page.locator('#item-hud')).toBeHidden();
  const after = await state(page);
  expect(
    held === 4 || held === 5
      ? after.player.boost > 0
      : after.pickups.effects.some((e) => e.owner === 0),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  expect((await state(page)).player.item).toBe(0);
  expect((await state(page)).pickups.effects).toHaveLength(0);
  expect((await state(page)).pickups.cooldowns.every((t) => t === 0)).toBe(true);
  expect(errors).toEqual([]);
});
test('touch pickup control is reachable and uses an acquired item', async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await page.locator('#open-setup').tap();
    await page.screenshot({ path: 'artifacts/pickups-setup-mobile.png' });
    await page.locator('#start').tap();
    await autopilot(page);
    await expect
      .poll(async () => (await state(page)).player.item, { timeout: 60000 })
      .toBeGreaterThan(0);
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }),
    );
    await page.locator('[data-touch-key="item"]').tap();
    await expect.poll(async () => (await state(page)).player.item).toBe(0);
    await page.screenshot({ path: 'artifacts/pickups-mobile.png' });
  } finally {
    await context.close();
  }
});
