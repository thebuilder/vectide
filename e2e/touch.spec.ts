import { test, expect } from '@playwright/test';
import type { Snapshot } from '../src/game/engine';
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test('mobile auto throttle yields to brake and the flip button loads and cancels safely', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-input', 'touch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#open-setup').tap();
  await page.locator('#start').tap();
  await page.waitForFunction(
    () => (window as unknown as { __vectide: { state: string } }).__vectide.state === 'racing',
  );
  const cdp = await page.context().newCDPSession(page);
  const center = async (key: string) => {
    const r = await page.locator(`[data-touch-key="${key}"]`).boundingBox();
    return { x: r!.x + r!.width / 2, y: r!.y + r!.height / 2 };
  };
  const state = () => page.evaluate(() => (window as unknown as { __vectide: Snapshot }).__vectide);
  await expect(page.locator('[data-touch-key="throttle"]')).toHaveCount(0);
  await expect.poll(async () => (await state()).speed).toBeGreaterThan(20);
  const brake = await center('brake'),
    flip = await center('flip'),
    left = await center('left');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...brake, id: 1 },
      { ...flip, id: 2 },
      { ...left, id: 3 },
    ],
  });
  for (const key of ['brake', 'flip', 'left'])
    await expect(page.locator(`[data-touch-key="${key}"]`)).toHaveClass(/held/);
  await expect.poll(async () => (await state()).speed).toBeLessThan(3);
  await expect.poll(async () => (await state()).player.air.charge).toBeGreaterThan(0.12);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...brake, id: 1 },
      { x: 195, y: 400, id: 2 },
      { ...left, id: 3 },
    ],
  });
  await expect(page.locator('[data-touch-key="flip"]')).toHaveClass(/held/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#touch-controls .held')).toHaveCount(0);
  await expect.poll(async () => (await state()).speed).toBeGreaterThan(12);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...flip, id: 1 }],
  });
  await expect.poll(async () => (await state()).player.air.charge).toBeGreaterThan(0.12);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#touch-controls .held')).toHaveCount(0);
  expect((await state()).player.air.queued).toBe(0);
  await page.screenshot({ path: 'artifacts/mobile-auto-throttle.png' });
  await page.locator('#pause').tap();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#resume').tap();
  await page.setViewportSize({ width: 844, height: 390 });
  for (const key of ['left', 'right', 'flip', 'brake']) {
    const box = await page.locator(`[data-touch-key="${key}"]`).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  }
});

test('touch reset is contextual and ordinary stops do not reveal it', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // Exercise the real touch UI policy with deterministic race situations.
    // @ts-expect-error Vite serves the source module to the browser.
    const { TouchControls } = await import('/src/touch.ts');
    const root = document.createElement('div');
    root.innerHTML =
      '<button data-touch-key="reset" hidden>RESET</button><button data-touch-key="item" hidden>USE</button>';
    const s = structuredClone((window as any).__vectide);
    const engine = {
      player: s.player,
      onlineMenuOpen: false,
      state: 'racing',
      touchInput: { throttle: 0, brake: 0, steer: 0, lean: 0 },
      reset() {},
    };
    const control = new TouchControls(engine, root);
    s.state = 'racing';
    s.missed = false;
    s.speed = 0;
    s.time = 10;
    const visible = () => !root.querySelector('button')!.hidden;
    control.sync(s);
    const idle = visible();
    s.missed = true;
    control.sync(s);
    const missed = visible();
    s.missed = false;
    s.player.x += 1000;
    control.sync(s);
    const offCourse = visible();
    s.player.x -= 1000;
    control.sync(s);
    s.time = 12.1;
    control.sync(s);
    const stuck = visible();
    s.speed = 20;
    control.sync(s);
    const moving = visible();
    s.state = 'paused';
    control.sync(s);
    const paused = visible();
    return { idle, missed, offCourse, stuck, moving, paused };
  });
  expect(result).toEqual({
    idle: false,
    missed: true,
    offCourse: true,
    stuck: true,
    moving: false,
    paused: false,
  });
});
