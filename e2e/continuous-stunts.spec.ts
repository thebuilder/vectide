import { expect, test } from '@playwright/test';

for (const device of ['keyboard', 'gamepad', 'touch'] as const)
  test.describe(device, () => {
    test.use(
      device === 'touch'
        ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }
        : {},
    );
    for (const axis of device === 'keyboard' ? ['flip', 'spin'] : ['flip'])
      test(`${device} prepares, controls and lands a ${axis}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        if (device === 'gamepad')
          await page.addInitScript(() => {
            const pad = {
              connected: true,
              axes: [0, 0, 0, 0],
              buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
            };
            Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
            (window as any).testPad = pad;
          });
        await page.route('**/src/main.ts*', async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()) + '\nwindow.__testEngine = engine;',
          });
        });
        await page.goto('/');
        if (device === 'touch') {
          await page.locator('#open-setup').tap();
          await page.locator('#start').tap();
        } else {
          await page.locator('#open-setup').click();
          await page.locator('#start').click();
        }
        await page.waitForFunction(() => (window as any).__vectide.state === 'racing');
        await page.evaluate(async () => {
          const e = (window as any).__testEngine;
          cancelAnimationFrame(e.frameId);
          e.start('trial');
          e.state = 'racing';
          const p = e.player,
            ramp = e.track.ramps[0];
          Object.assign(p, {
            x: ramp.x - ramp.tx * 18,
            z: ramp.z - ramp.tz * 18,
            yaw: Math.atan2(ramp.tx, ramp.tz),
            vx: ramp.tx * 22,
            vz: ramp.tz * 22,
            nextGate: ramp.targetGate,
          });
          const path = '/src/game/water.ts',
            { waterHeight } = await import(path);
          p.y = waterHeight(p.x, p.z, e.visualTime, e.track) + 0.6;
          e.cameraAnchor.set(p.x, p.y, p.z);
          e.previous = 1000;
        });
        const cdp = device === 'touch' ? await page.context().newCDPSession(page) : undefined;
        const touchPoint = async (key: string) => {
          const bounds = (await page.locator(`[data-touch-key="${key}"]`).boundingBox())!;
          return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 };
        };
        if (device === 'keyboard') {
          await page.keyboard.down('w');
          await page.keyboard.down('e');
        } else if (device === 'gamepad')
          await page.evaluate(() => {
            const p = (window as any).testPad;
            p.buttons[7] = p.buttons[5] = { pressed: true, value: 1 };
          });
        else
          await cdp!.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [await touchPoint('flip')],
          });
        const advance = (until: string) =>
          page.evaluate(
            ({ until, axis }) => {
              const e = (window as any).__testEngine,
                p = e.player,
                ramp = e.track.ramps[0];
              for (let i = 0; i < 240; i++) {
                e.frame(e.previous + 1000 / 60);
                cancelAnimationFrame(e.frameId);
                const rotation = axis === 'flip' ? p.air.pitch : p.air.yaw;
                const along = (p.x - ramp.x) * ramp.tx + (p.z - ramp.z) * ramp.tz;
                if (
                  (until === 'lip' && p.onRamp && along > ramp.length / 2 - 1) ||
                  (until === 'armed' && p.air.armed) ||
                  (until === 'mid' && rotation > Math.PI) ||
                  (until === 'release' && rotation > Math.PI * 2 - 0.6) ||
                  (until === 'land' && !p.air.armed && p.wet > 0)
                ) {
                  return {
                    armed: p.air.armed,
                    rotation,
                    message: p.air.message,
                    phase: p.recovery.phase,
                    speed: Math.hypot(p.vx, p.vz),
                    input: e.input(),
                    pose: e.riderPose,
                  };
                }
              }
              throw new Error(`Never reached ${until}: ${JSON.stringify(p.air)}`);
            },
            { until, axis },
          );
        expect((await advance('lip')).input.trick).toBe(1);
        if (device === 'keyboard') await page.keyboard.up('e');
        else if (device === 'gamepad')
          await page.evaluate(() => {
            (window as any).testPad.buttons[5] = { pressed: false, value: 0 };
          });
        else await cdp!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const armed = await advance('armed');
        expect(Math.abs(armed.rotation)).toBeLessThan(0.15);
        expect(armed.input.throttle).toBe(1);
        if (device === 'keyboard') await page.keyboard.down(axis === 'flip' ? 'Shift' : 'a');
        else if (device === 'gamepad')
          await page.evaluate(() => {
            (window as any).testPad.axes[1] = 1;
          });
        else {
          const point = await touchPoint('stick');
          await cdp!.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          await cdp!.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ ...point, y: point.y + 60 }],
          });
        }
        const middle = await advance('mid');
        expect(Math.max(...middle.pose.handErrors, ...middle.pose.footErrors)).toBeLessThan(0.015);
        await page.screenshot({ path: `artifacts/continuous-${device}-${axis}.png` });
        await advance('release');
        if (device === 'keyboard') await page.keyboard.up(axis === 'flip' ? 'Shift' : 'a');
        else if (device === 'gamepad')
          await page.evaluate(() => {
            (window as any).testPad.axes[1] = 0;
          });
        else await cdp!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const landing = await advance('land');
        expect(landing.phase).toBe('riding');
        expect(landing.message).toBe(axis === 'flip' ? 'BACKFLIP LANDED' : '360 SPIN LANDED');
        expect(landing.speed).toBeGreaterThan(15);
        expect(errors).toEqual([]);
      });
  });

test('keyboard counter-input carries the spin before reversing', async ({ page }) => {
  await page.goto('/e2e/fixtures/coast.html');
  await page.waitForFunction(() => !!(window as any).demo);
  await page.evaluate(() => {
    const e = (window as any).demo;
    cancelAnimationFrame(e.frameId);
    e.onFrame = () => {};
    e.start('trial');
    e.state = 'racing';
    Object.assign(e.player, { y: 30, vy: 0, wet: 0, onRamp: false });
    e.player.air.armed = true;
    e.player.body.airtime = 0.1;
    e.previous = 1000;
  });
  const advance = (frames: number) =>
    page.evaluate((frames) => {
      const e = (window as any).demo;
      for (let i = 0; i < frames; i++) {
        e.frame(e.previous + 1000 / 60);
        cancelAnimationFrame(e.frameId);
      }
      return {
        rotation: e.player.air.pitch,
        velocity: e.player.air.pitchVelocity,
        armed: e.player.air.armed,
      };
    }, frames);
  await page.keyboard.down('Shift');
  const spinning = await advance(30);
  expect(spinning.velocity).toBeGreaterThan(6);
  await page.keyboard.up('Shift');
  await page.keyboard.down('c');
  const braking = await advance(12);
  expect(braking.armed).toBe(true);
  expect(braking.velocity).toBeGreaterThan(0);
  expect(braking.rotation).toBeGreaterThan(spinning.rotation);
  const reversing = await advance(12);
  expect(reversing.velocity).toBeLessThan(0);
  await page.keyboard.up('c');
});
