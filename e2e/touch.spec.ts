import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test('mobile menu fits and simultaneous touch controls release safely', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-input', 'touch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#start').tap();
  await page.waitForFunction(
    () => (window as unknown as { __vectide: { state: string } }).__vectide.state === 'racing',
  );
  const cdp = await page.context().newCDPSession(page);
  const center = async (key: string) => {
    const r = await page.locator(`[data-touch-key="${key}"]`).boundingBox();
    return { x: r!.x + r!.width / 2, y: r!.y + r!.height / 2 };
  };
  const go = await center('throttle'),
    left = await center('left');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...go, id: 1 },
      { ...left, id: 2 },
    ],
  });
  await expect(page.locator('[data-touch-key="throttle"]')).toHaveClass(/held/);
  await expect(page.locator('[data-touch-key="left"]')).toHaveClass(/held/);
  await page.waitForFunction(
    () => (window as unknown as { __vectide: { speed: number } }).__vectide.speed > 8,
  );
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 195, y: 400, id: 1 },
      { ...left, id: 2 },
    ],
  });
  await expect(page.locator('[data-touch-key="throttle"]')).toHaveClass(/held/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#touch-controls .held')).toHaveCount(0);
  await expect(page.locator('[data-touch-key="lean"]')).toHaveCount(0);
  await page.locator('#pause').tap();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#resume').tap();
  await page.setViewportSize({ width: 844, height: 390 });
  for (const key of ['left', 'right', 'throttle', 'brake']) {
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
    root.innerHTML = '<button data-touch-key="reset" hidden>RESET</button>';
    const engine = {
      state: 'racing',
      touchInput: { throttle: 0, brake: 0, steer: 0, lean: 0 },
      reset() {},
    };
    const control = new TouchControls(engine, root);
    const s = structuredClone((window as any).__vectide);
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
    engine.touchInput.throttle = 1;
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
