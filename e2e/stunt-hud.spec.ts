import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('vectide:driving-tips:v1', '{"keyboard":15,"touch":15}'),
  );
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
  await page.waitForFunction(() => (window as any).__vectide.state === 'racing');
  await page.evaluate(() => {
    const e = (window as any).__testEngine;
    cancelAnimationFrame(e.frameId);
    e.start('trial');
    e.state = 'racing';
    e.time = 5;
    e.input = () => ({ throttle: 0, steer: 0, brake: 0, lean: 0, trick: 0 });
    e.previous = 1000;
  });
}

async function advance(page: Page, frames: number) {
  return page.evaluate((frames) => {
    const e = (window as any).__testEngine;
    for (let i = 0; i < frames; i++) {
      e.frame(e.previous + 1000 / 60);
      cancelAnimationFrame(e.frameId);
    }
    return document.getElementById('stunt-hud')!.getAnimations()[0]?.currentTime;
  }, frames);
}

/** Put a rotated hull just above the water; the real contact solver grades the landing. */
async function land(page: Page, pitch: number, yaw: number) {
  await page.evaluate(
    async ({ pitch, yaw }) => {
      const e = (window as any).__testEngine,
        p = e.player;
      const path = '/src/game/water.ts',
        { waterHeight } = await import(path);
      Object.assign(p, {
        x: -100,
        z: -150,
        y: waterHeight(-100, -150, e.visualTime, e.track) + 0.8,
        vy: -5,
        vx: 0,
        vz: 16,
        pitch: 0,
        roll: 0,
        yaw: 0,
        pitchVelocity: 0,
        rollVelocity: 0,
        wet: 0,
        onRamp: false,
      });
      p.body.airtime = 0.3;
      Object.assign(p.air, {
        armed: true,
        pitch: (pitch * Math.PI) / 180,
        yaw: (yaw * Math.PI) / 180,
        pitchVelocity: 0,
        yawVelocity: 0,
      });
      e.cameraAnchor.set(p.x, p.y, p.z);
    },
    { pitch, yaw },
  );
  await advance(page, 24);
}

test('successful rotations appear as animated trick text, including consecutive identical landings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  const hud = page.locator('#stunt-hud');
  for (const [pitch, yaw, name] of [
    [0, 180, '180 SPIN'],
    [0, 360, '360 SPIN'],
    [0, 1080, '1080 SPIN!'],
    [360, 0, 'BACKFLIP'],
    [-360, 0, 'FRONTFLIP'],
    [360, 360, 'BACKFLIP + 360 SPIN'],
  ] as const) {
    await land(page, pitch, yaw);
    await expect(hud).toBeVisible();
    await expect(hud).toHaveText(name);
    await expect(page.locator('#stunt-announcement')).toHaveText(`${name} LANDED`);
    await page.screenshot({ path: `artifacts/trick-text-${pitch}-${yaw}.png` });
  }
  const styles = await hud.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      border: s.borderWidth,
      shadow: s.boxShadow,
      opacity: Number(s.opacity),
    };
  });
  expect(styles).toEqual({
    background: 'rgba(0, 0, 0, 0)',
    border: '0px',
    shadow: 'none',
    opacity: 1,
  });
  await advance(page, 35);
  await hud.evaluate((el) => ((window as any).previousStuntAnimation = el.getAnimations()[0]));
  await land(page, 360, 360);
  expect(
    await hud.evaluate((el) => el.getAnimations()[0] !== (window as any).previousStuntAnimation),
  ).toBe(true);
  await advance(page, 140);
  await expect(hud).toBeHidden();
  expect(errors).toEqual([]);
});

test('stunt text freezes during pause and clears on restart', async ({ page }) => {
  await start(page);
  await land(page, 0, 360);
  await page.locator('#pause').click();
  const pausedAt = await advance(page, 1);
  expect(await advance(page, 90)).toBe(pausedAt);
  await page.locator('#resume').click();
  expect(Number(await advance(page, 12))).toBeGreaterThan(Number(pausedAt));
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  await expect(page.locator('#stunt-hud')).toBeHidden();
});

test('crashes and ordinary jumps do not announce tricks', async ({ page }) => {
  await start(page);
  await land(page, 0, 0);
  await expect(page.locator('#stunt-hud')).toBeHidden();
  await land(page, 180, 360);
  await expect(page.locator('#stunt-hud')).toBeHidden();
  await expect(page.locator('#stunt-announcement')).toBeEmpty();
});

test.describe('phone and reduced motion', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  test('keeps combo text within the viewport and replaces movement with a fade', async ({
    page,
  }) => {
    await start(page);
    await land(page, 360, 1080);
    const hud = page.locator('#stunt-hud');
    await expect(hud).toHaveText('BACKFLIP + 1080 SPIN!');
    expect(await hud.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    const bounds = (await hud.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(844);
    expect(bounds.y + bounds.height).toBeLessThan(200);
    await page.screenshot({ path: 'artifacts/trick-text-phone.png' });
  });
});
