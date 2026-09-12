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
  await expect(page.getByRole('button', { name: 'JUMP', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('touch-action', 'none');
  await expect(page.locator('[data-touch-key="flip"]')).toHaveCSS('user-select', 'none');
  await expect(page.locator('[data-touch-key="throttle"]')).toHaveCount(0);
  await expect.poll(async () => (await state()).speed).toBeGreaterThan(20);
  const brake = await center('brake'),
    flip = await center('flip'),
    left = await center('stick');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...brake, id: 1 },
      { ...flip, id: 2 },
      { ...left, id: 3 },
    ],
  });
  for (const key of ['brake', 'flip', 'stick'])
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
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
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
  expect((await state()).player.air.queued).toBe(false);
  await page.screenshot({ path: 'artifacts/mobile-auto-throttle.png' });
  await page.locator('#pause').tap();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await expect(page.locator('#resume')).toHaveCSS('user-select', 'none');
  await page.locator('#resume').tap();
  await page.setViewportSize({ width: 844, height: 390 });
  for (const key of ['stick', 'flip', 'brake']) {
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
    s.player.x = s.track.gates[0].x;
    s.player.z = s.track.gates[0].z;
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
    s.state = 'freeride';
    s.time = 20;
    s.speed = 0;
    engine.touchInput.brake = 1;
    control.sync(s);
    s.time = 23;
    control.sync(s);
    const practiceBraking = visible();
    engine.touchInput.brake = 0;
    control.sync(s);
    const practiceIdle = visible();
    s.time = 25.1;
    control.sync(s);
    const practiceStuck = visible();
    s.speed = 20;
    control.sync(s);
    const practiceMoving = visible();
    return {
      idle,
      missed,
      offCourse,
      stuck,
      moving,
      paused,
      practiceBraking,
      practiceIdle,
      practiceStuck,
      practiceMoving,
    };
  });
  expect(result).toEqual({
    idle: false,
    missed: true,
    offCourse: true,
    stuck: true,
    moving: false,
    paused: false,
    practiceBraking: false,
    practiceIdle: false,
    practiceStuck: true,
    practiceMoving: false,
  });
});

test('thumbstick slides continuously in both axes and clears on interruption', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine = engine;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').tap();
  const back = await page.locator('#setup-back').boundingBox();
  expect(back!.x).toBeLessThan(24);
  expect(back!.y).toBeLessThan(24);
  await page.locator('#start').tap();
  await page.waitForFunction(() => (window as any).__vectide.state === 'racing');
  const stick = page.locator('[data-touch-key="stick"]');
  const bounds = (await stick.boundingBox())!;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  const input = () => page.evaluate(() => ({ ...(window as any).__testEngine.touchInput }));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...center, id: 1 }],
  });
  await expect.poll(async () => (await input()).steer).toBe(0);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: center.x - 24, y: center.y - 24, id: 1 }],
  });
  await expect.poll(async () => (await input()).steer).toBeGreaterThan(0.3);
  await expect.poll(async () => (await input()).lean).toBeLessThan(-0.3);
  // Cross the center without lifting; pulling back now lifts the nose.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: center.x + 24, y: center.y + 24, id: 1 }],
  });
  await expect.poll(async () => (await input()).steer).toBeLessThan(-0.3);
  await expect.poll(async () => (await input()).lean).toBeGreaterThan(0.3);
  // Capture keeps steering alive well beyond the circular hit target.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: center.x + 160, y: center.y, id: 1 }],
  });
  await expect.poll(async () => (await input()).steer).toBeCloseTo(-1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect.poll(async () => (await input()).steer).toBe(0);
  await expect.poll(async () => (await input()).lean).toBe(0);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: center.x - 24, y: center.y, id: 1 }],
  });
  await expect.poll(async () => (await input()).steer).toBeGreaterThan(0.3);
  await page.locator('#pause').dispatchEvent('click');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await expect.poll(async () => (await input()).steer).toBe(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.locator('#resume').tap();
  const timer = (await page.locator('#timer').boundingBox())!;
  const sound = (await page.locator('#sound').boundingBox())!;
  expect(timer.x).toBeLessThan(24);
  expect(timer.y).toBeLessThan(100);
  expect(timer.x + timer.width).toBeLessThan(sound.x);
  await expect(page.locator('.speaker-icon')).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-thumbstick.png' });
});
