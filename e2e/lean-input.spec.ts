import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
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
});

for (const code of ['KeyC', 'ShiftLeft']) {
  test(`${code} does not latch lean across a shortcut, takeoff, and crash`, async ({ page }) => {
    const result = await page.evaluate(async (code) => {
      const e = (window as any).__testEngine;
      cancelAnimationFrame(e.frameId);
      e.start('trial');
      e.state = 'racing';
      const ramp = e.track.ramps[0];
      Object.assign(e.player, {
        x: ramp.x - ramp.tx * 18,
        z: ramp.z - ramp.tz * 18,
        yaw: Math.atan2(ramp.tx, ramp.tz),
        vx: ramp.tx * 22,
        vz: ramp.tz * 22,
      });
      const waterPath = '/src/game/water.ts';
      const { waterHeight } = await import(waterPath);
      e.player.y = waterHeight(e.player.x, e.player.z, e.visualTime, e.track) + 0.6;
      const key = (type: string, code: string, options = {}) =>
        window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, ...options }));
      key('keydown', 'KeyW');
      let tookOff = false;
      for (let frame = 0; frame < 240; frame++) {
        e.frame(e.previous + 1000 / 60);
        cancelAnimationFrame(e.frameId);
        if (e.player.body.airtime > 0.15) {
          tookOff = true;
          break;
        }
      }
      const neutralAtTakeoff = e.input().lean;
      // Model a shortcut whose character/Shift keyup is intercepted, while Meta release reaches the page.
      if (code === 'ShiftLeft') key('keydown', code, { shiftKey: true });
      key('keydown', 'MetaLeft', { metaKey: true, shiftKey: code === 'ShiftLeft' });
      key('keydown', code === 'KeyC' ? code : 'Digit4', {
        metaKey: true,
        shiftKey: code === 'ShiftLeft',
      });
      key('keyup', 'MetaLeft');
      const afterShortcut = e.input().lean;
      const recoveryPath = '/src/game/recovery.ts';
      const { beginRecovery } = await import(recoveryPath);
      beginRecovery(e.player);
      for (let frame = 0; frame < 600; frame++) {
        e.frame(e.previous + 1000 / 60);
        cancelAnimationFrame(e.frameId);
      }
      const afterCrash = {
        input: e.input().lean,
        lean: e.player.lean,
        phase: e.player.recovery.phase,
      };
      key('keydown', code, { shiftKey: code === 'ShiftLeft' });
      key('keyup', code);
      const afterRetap = e.input().lean;
      return { tookOff, neutralAtTakeoff, afterShortcut, afterCrash, afterRetap };
    }, code);
    console.log(code, result);
    expect(result.tookOff).toBe(true);
    expect(result.neutralAtTakeoff).toBe(0);
    expect(result.afterCrash.phase).toBe('riding');
    expect(result.afterRetap).toBe(0);
    expect(result.afterShortcut).toBe(0);
    expect(result.afterCrash.input).toBe(0);
    expect(Math.abs(result.afterCrash.lean)).toBeLessThan(0.01);
  });
}

test('keeps ordinary lean holds working and cancels shortcut-induced trick release', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const e = (window as any).__testEngine;
    cancelAnimationFrame(e.frameId);
    e.start('trial');
    e.state = 'racing';
    const key = (type: string, code: string, options = {}) =>
      window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, ...options }));
    key('keydown', 'ShiftLeft', { shiftKey: true });
    key('keydown', 'KeyW', { shiftKey: true });
    const heldWithThrottle = e.input().lean;
    key('keyup', 'KeyW', { shiftKey: true });
    const heldWithoutThrottle = e.input().lean;
    key('keyup', 'ShiftLeft');
    const releasedBack = e.input().lean;
    key('keydown', 'KeyC');
    const heldForward = e.input().lean;
    key('keyup', 'KeyC');
    const releasedForward = e.input().lean;
    key('keydown', 'ShiftRight', { shiftKey: true });
    // A later event reports Shift released, even if its dedicated keyup was lost.
    key('keydown', 'KeyW');
    const healedShift = e.input().lean;
    key('keyup', 'KeyW');
    const shortcuts = ['Meta', 'Control', 'Alt'].map((modifier) => {
      const options = {
        metaKey: modifier === 'Meta',
        ctrlKey: modifier === 'Control',
        altKey: modifier === 'Alt',
      };
      key('keydown', modifier + 'Left', options);
      key('keydown', 'KeyC', options);
      const during = e.input().lean;
      key('keydown', 'KeyR', options);
      key('keyup', modifier + 'Left');
      return { during, after: e.input().lean, recovered: e.player.recovered };
    });
    key('keydown', 'KeyE');
    for (let frame = 0; frame < 30; frame++) {
      e.frame(e.previous + 1000 / 60);
      cancelAnimationFrame(e.frameId);
    }
    const chargeBeforeShortcut = e.player.air.charge;
    key('keydown', 'MetaLeft', { metaKey: true });
    key('keyup', 'MetaLeft');
    for (let frame = 0; frame < 3; frame++) {
      e.frame(e.previous + 1000 / 60);
      cancelAnimationFrame(e.frameId);
    }
    return {
      heldWithThrottle,
      heldWithoutThrottle,
      releasedBack,
      heldForward,
      releasedForward,
      healedShift,
      shortcuts,
      chargeBeforeShortcut,
      charge: e.player.air.charge,
      queued: e.player.air.queued,
      armed: e.player.air.armed,
    };
  });
  expect(result.heldWithThrottle).toBe(1);
  expect(result.heldWithoutThrottle).toBe(1);
  expect(result.releasedBack).toBe(0);
  expect(result.heldForward).toBe(-1);
  expect(result.releasedForward).toBe(0);
  expect(result.healedShift).toBe(0);
  expect(result.shortcuts).toEqual(Array(3).fill({ during: 0, after: 0, recovered: false }));
  expect(result.chargeBeforeShortcut).toBeGreaterThan(0.12);
  expect(result.charge).toBe(0);
  expect(result.queued).toBe(false);
  expect(result.armed).toBe(false);
});
