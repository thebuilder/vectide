import { test, expect, type Page } from '@playwright/test';
import { PeerServer } from 'peer';
import type { Server } from 'node:http';
import type { Room } from '../src/multiplayer/room';
import type { Snapshot } from '../src/game/engine';

declare global {
  interface Window {
    room: Room;
    error: string;
    drive: { throttle: number; steer: number; brake: number; lean: number };
  }
}
let server: Server;
test.beforeAll(async () => {
  await new Promise<void>((resolve) => {
    PeerServer({ host: '127.0.0.1', port: 9001 }, (listener) => {
      server = listener;
      resolve();
    });
  });
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vectide: Snapshot }).__vectide);
async function openOnline(page: Page, action = 'HOST') {
  await page.goto('/');
  await page.getByRole('button', { name: action, exact: true }).click();
}

test('two rendered racers join, sync course and countdown, drive, open menu and leave', async ({
  browser,
}) => {
  const hostContext = await browser.newContext({ reducedMotion: 'reduce' });
  const guestContext = await browser.newContext({ reducedMotion: 'reduce' });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  host.on('pageerror', (e) => errors.push(e.message));
  guest.on('pageerror', (e) => errors.push(e.message));
  try {
    await openOnline(host);
    await expect(host.locator('#online-lobby')).toBeVisible();
    const code = await host.locator('#room-code').inputValue();
    await expect(host.getByRole('button', { name: 'START RACE', exact: true })).toBeDisabled();
    await openOnline(guest, 'JOIN');
    await guest.getByLabel('Racer name').fill('<img src=x>');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'JOIN ROOM' }).click();
    await expect(host.locator('#room-count')).toHaveText('2 RACERS');
    await expect(host.locator('#room-racers')).toContainText('<img src=x>');
    await expect(host.locator('#room-racers img')).toHaveCount(0);
    await expect.poll(async () => (await state(host)).state).toBe('lobby');
    await expect.poll(async () => (await state(guest)).racers.length).toBe(2);
    await guest.getByLabel('Your name').fill('WAVE RUNNER');
    await guest.getByLabel('Your name').press('Enter');
    await guest.getByRole('button', { name: 'Gold', exact: true }).click();
    await expect(host.locator('#room-racers')).toContainText('WAVE RUNNER');
    await expect.poll(async () => (await state(host)).racers[1].color).toBe('#ffbc57');
    await expect(guest.getByRole('button', { name: 'Gold', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await host.getByLabel('Your name').fill('HOST');
    await host.getByLabel('Your name').press('Enter');
    await expect(guest.locator('#room-racers')).toContainText('HOST');
    await host.locator('[data-room-track="1"]').click();
    await expect(guest.locator('[data-room-track="1"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(guest.locator('[data-room-track="1"]')).toBeDisabled();
    await host.screenshot({ path: 'artifacts/multiplayer-lobby.png' });
    await host.getByRole('button', { name: 'START RACE', exact: true }).click();
    await expect(host.locator('#hud')).toBeVisible();
    await expect(guest.locator('#hud')).toBeVisible();
    await expect.poll(async () => (await state(guest)).state).toBe('racing');
    expect((await state(host)).racers).toHaveLength(2);
    expect((await state(guest)).player.id).toBe(1);
    expect((await state(guest)).track.id).toBe('harbor');
    expect(Math.abs((await state(host)).time - (await state(guest)).time)).toBeLessThan(0.3);
    await guest.bringToFront();
    await guest.keyboard.down('w');
    await expect.poll(async () => (await state(guest)).speed).toBeGreaterThan(15);
    await expect
      .poll(async () => {
        const racer = (await state(host)).racers[1];
        return Math.hypot(racer.vx, racer.vz) * 3.6;
      })
      .toBeGreaterThan(15);
    await guest.keyboard.up('w');
    await guest.keyboard.press('Escape');
    await expect(guest.locator('#pause-dialog')).toBeVisible();
    await expect(guest.locator('#pause-note')).toContainText('keeps running');
    const time = (await state(guest)).time;
    await expect.poll(async () => (await state(guest)).time).toBeGreaterThan(time + 0.15);
    await guest.getByRole('button', { name: 'KEEP RIDING' }).click();
    await guest.keyboard.press('r');
    await expect.poll(async () => (await state(host)).racers[1].recovered).toBe(true);
    await guest.screenshot({ path: 'artifacts/multiplayer-race.png' });
    await guest.keyboard.press('Escape');
    await guest.getByRole('button', { name: 'LEAVE RACE', exact: true }).click();
    await expect(guest.locator('#menu')).toBeVisible();
    await expect(host.locator('#online-race-status')).toContainText('1 DISCONNECTED');
    await host.keyboard.press('Escape');
    await host.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
    // The room survives the race, and a departed guest can rejoin the same code.
    await expect(host.locator('#online-lobby')).toBeVisible();
    const next = await host.locator('#room-code').inputValue();
    expect(next).toBe(code);
    await guest.getByRole('button', { name: 'JOIN', exact: true }).click();
    await guest.getByLabel('Room code', { exact: true }).fill(next);
    await guest.getByRole('button', { name: 'JOIN ROOM' }).click();
    await expect(host.locator('#room-count')).toHaveText('2 RACERS');
    await host.getByRole('button', { name: 'Leave room' }).click();
    await expect(guest.locator('#online-status')).toContainText('host');
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('twelve real WebRTC clients race, reject a thirteenth and late joins, and detect host loss', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const clients: Page[] = [];
  const errors: string[] = [];
  try {
    const host = await context.newPage();
    host.on('pageerror', (error) => errors.push(error.message));
    await openOnline(host);
    await expect(host.locator('#online-lobby')).toBeVisible();
    const code = await host.locator('#room-code').inputValue();
    for (let i = 0; i < 12; i++) {
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/e2e/fixtures/multiplayer.html');
      await page.waitForFunction(() => !!window.room);
      clients.push(page);
    }
    await Promise.all(
      clients.slice(0, 11).map((page, index) =>
        page.evaluate(({ code, index }) => room.open(false, `RACER ${index}`, code), {
          code,
          index,
        }),
      ),
    );
    await expect(host.locator('#room-count')).toHaveText('12 RACERS');
    await clients[11].evaluate((code) => room.open(false, 'THIRTEEN', code), code);
    await expect.poll(() => clients[11].evaluate(() => window.error)).toContain('full');
    await host.bringToFront();
    await host.screenshot({ path: 'artifacts/multiplayer-twelve-lobby.png' });
    await host.setViewportSize({ width: 375, height: 667 });
    for (const id of ['room-code', 'leave-room', 'profile-name', 'room-courses', 'start-room']) {
      const box = await host.locator(`#${id}`).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(667);
    }
    await host.screenshot({ path: 'artifacts/multiplayer-twelve-mobile.png' });
    await host.setViewportSize({ width: 1280, height: 800 });
    await host.getByRole('button', { name: 'START RACE', exact: true }).click();
    await expect
      .poll(() => Promise.all(clients.slice(0, 11).map((p) => p.evaluate(() => room.phase))))
      .toEqual(Array(11).fill('racing'));
    await expect.poll(async () => (await state(host)).state).toBe('racing');
    const slots = await Promise.all(
      clients.slice(0, 11).map((p) => p.evaluate(() => room.race!.player.id)),
    );
    expect(new Set([0, ...slots]).size).toBe(12);
    expect((await state(host)).racers).toHaveLength(12);
    // Disconnect only PeerJS signaling; keep the actual WebRTC data channel alive.
    await clients[0].evaluate(() => {
      (room as unknown as { peer: { disconnect(): void } }).peer.disconnect();
    });
    await expect.poll(() => clients[0].evaluate(() => room.signalingConnected)).toBe(true);
    expect(await clients[0].evaluate(() => room.phase)).toBe('racing');
    expect(await clients[0].evaluate(() => room.members.length)).toBe(12);

    await expect(host.locator('#position')).toContainText('/ 12');
    await Promise.all(
      clients.slice(0, 11).map((p) =>
        p.evaluate(() => {
          window.drive = { throttle: 1, brake: 0, steer: 0, lean: 0 };
        }),
      ),
    );
    await host.keyboard.down('w');
    await expect
      .poll(async () => (await state(host)).racers.filter((r) => Math.hypot(r.vx, r.vz) > 3).length)
      .toBe(12);
    await host.keyboard.up('w');
    await host.screenshot({ path: 'artifacts/multiplayer-twelve-race.png' });
    const pending = await Promise.all(
      clients.slice(0, 11).map((p) => p.evaluate(() => room.race!.pendingCount)),
    );
    expect(Math.max(...pending)).toBeLessThan(120);
    await clients[11].evaluate((code) => room.open(false, 'LATE', code), code);
    await expect.poll(() => clients[11].evaluate(() => window.error)).toContain('already started');
    await clients[10].evaluate(() => room.close());
    await expect(host.locator('#online-race-status')).toContainText('1 DISCONNECTED');
    await host.close();
    await expect
      .poll(() => clients[0].evaluate(() => window.error), { timeout: 10000 })
      .toContain('host');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('phone menu exposes host and join without scrolling and opens a water lobby', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    reducedMotion: 'reduce',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    for (const size of [
      { width: 375, height: 667 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(size);
      for (const id of ['host-online', 'join-online']) {
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box!.y).toBeGreaterThan(0);
        expect(box!.y + box!.height).toBeLessThan(size.height);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.locator('#menu').evaluate((el) => el.scrollTop)).toBe(0);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.wordmark')).toBeVisible();
    const logoSize = await page
      .locator('.wordmark')
      .evaluate((el) => getComputedStyle(el).fontSize);
    await page.screenshot({ path: 'artifacts/multiplayer-menu-mobile.png' });
    await page.getByRole('button', { name: 'JOIN', exact: true }).tap();
    await expect(page.getByLabel('Room code', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Racer name', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Racer name', { exact: true })).toHaveAttribute(
      'placeholder',
      'RACER',
    );
    await page.locator('#cancel-online').tap();
    await page.getByRole('button', { name: 'HOST', exact: true }).tap();
    await expect(page.locator('#online-lobby')).toBeVisible();
    await expect.poll(async () => (await state(page)).state).toBe('lobby');
    await expect(page.getByLabel('Your name')).toHaveValue('');
    await expect(page.getByLabel('Your name')).toHaveCSS('user-select', 'text');
    await expect(page.getByLabel('Your name')).toHaveAttribute('placeholder', 'RACER 1');
    await expect(page.locator('#room-racers')).toContainText('RACER 1');
    await page.getByRole('button', { name: 'Gold', exact: true }).tap();
    await expect(page.getByLabel('Your name')).toHaveValue('');
    for (const id of ['room-code', 'leave-room', 'profile-name', 'room-courses', 'start-room']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(667);
    }
    await expect(page.locator('.wordmark')).toBeHidden();
    const roomPanel = await page.locator('.room-code-panel').boundingBox();
    await page.screenshot({ path: 'artifacts/multiplayer-lobby-mobile.png' });
    await page.getByRole('button', { name: 'FREE RIDE', exact: true }).tap();
    await expect.poll(async () => (await state(page)).state).toBe('freeride');
    await expect(page.locator('#room-code')).toBeVisible();
    expect(await page.locator('.room-code-panel').boundingBox()).toEqual(roomPanel);
    await expect(page.locator('#leave-room')).toBeHidden();
    await expect(page.locator('.masthead #leave-practice')).toBeVisible();
    await expect(page.locator('#practice-controls')).toBeHidden();
    const back = await page.locator('#leave-practice').boundingBox();
    const sound = await page.locator('#sound').boundingBox();
    expect(Math.abs(back!.y - sound!.y)).toBeLessThan(1);
    expect(back!.x + back!.width).toBeLessThan(sound!.x);
    expect(back!.y + back!.height).toBeLessThan(roomPanel!.y);
    expect(back!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#touch-controls')).toBeVisible();
    await expect(page.locator('#touch-controls')).toHaveJSProperty('inert', false);
    await expect(page.locator('#lobby-labels [data-slot="0"]')).toHaveCount(0);
    await expect(page.locator('[data-touch-key="throttle"]')).toHaveCount(0);
    await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(20);
    const brake = page.locator('[data-touch-key="brake"]');
    const brakeBox = (await brake.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: brakeBox.x + brakeBox.width / 2, y: brakeBox.y + brakeBox.height / 2 }],
    });
    await expect(brake).toHaveClass(/held/);
    await expect.poll(async () => (await state(page)).speed).toBeLessThan(3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(12);
    await page.screenshot({ path: 'artifacts/multiplayer-free-ride-mobile.png' });
    await page.getByRole('button', { name: 'BACK TO LOBBY' }).tap();
    await expect.poll(async () => (await state(page)).state).toBe('lobby');
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.locator('#touch-controls')).toBeHidden();
    await page.getByRole('button', { name: 'Leave room' }).tap();
    await expect(page.locator('#menu')).toBeVisible();
    expect((await state(page)).state).toBe('menu');
    await expect(page.locator('.wordmark')).toBeVisible();
    expect(await page.locator('.wordmark').evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      logoSize,
    );
  } finally {
    await context.close();
  }
});

test('lobby free ride synchronizes riders and moves everyone to a fresh race', async ({
  browser,
}) => {
  const hostContext = await browser.newContext({ reducedMotion: 'reduce' });
  const guestContext = await browser.newContext({ reducedMotion: 'reduce' });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', (e) => errors.push(e.message));
  try {
    await openOnline(host);
    await expect(host.locator('#online-lobby')).toBeVisible();
    const code = await host.locator('#room-code').inputValue();
    await openOnline(guest, 'JOIN');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'JOIN ROOM' }).click();
    await expect(guest.locator('#room-count')).toHaveText('2 RACERS');
    await host.locator('#room-pickups').click();
    await expect(guest.locator('#room-pickups')).toHaveAttribute('aria-pressed', 'false');
    await expect(guest.locator('#room-pickups')).toBeDisabled();
    await host.locator('#room-pickups').click();
    await expect(guest.locator('#room-pickups')).toHaveAttribute('aria-pressed', 'true');
    const music = () =>
      guest.evaluate(
        () =>
          (
            window as unknown as {
              __vectide: { audio: { song: string; time: number; playing: boolean } };
            }
          ).__vectide.audio,
      );
    await expect.poll(async () => (await music()).time).toBeGreaterThan(0.15);
    const lobbyMusic = await music();
    const start = await state(guest);
    await guest.getByRole('button', { name: 'FREE RIDE', exact: true }).click();
    await expect.poll(async () => (await state(guest)).state).toBe('freeride');
    expect((await music()).song).toBe('Horizon Lane');
    await expect.poll(async () => (await music()).time).toBeGreaterThan(0.3);
    expect((await music()).playing).toBe(true);
    await expect(guest.locator('.lobby-panel')).toBeHidden();
    await expect(guest.locator('#room-code')).toBeVisible();
    await expect(guest.locator('#room-code')).toHaveValue(code);
    await guestContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    await guest.getByRole('button', { name: 'Copy room join link', exact: true }).click();
    await expect(guest.locator('#copy-room')).toHaveText('COPIED');
    expect(await guest.evaluate(() => navigator.clipboard.readText())).toBe(
      `https://vectide.thebuilder.dk/?join=${code}`,
    );
    await expect(guest.locator('#checkpoint')).toBeHidden();
    await expect(guest.locator('.race-top')).toBeHidden();
    await guest.bringToFront();
    await guest.keyboard.down('w');
    await expect.poll(async () => (await state(guest)).speed).toBeGreaterThan(35);
    await expect
      .poll(async () => (await state(host)).racers[1].z - start.player.z)
      .toBeGreaterThan(15);
    await guest.keyboard.up('w');
    expect((await state(host)).state).toBe('lobby');
    expect((await state(guest)).player.passed).toBe(0);
    expect((await state(guest)).track.ramps).toHaveLength(2);
    await guest.screenshot({ path: 'artifacts/multiplayer-free-ride.png' });
    await guest.keyboard.press('Escape');
    await expect(guest.locator('.lobby-panel')).toBeVisible();
    await expect.poll(async () => (await state(guest)).state).toBe('lobby');
    expect((await music()).song).toBe(lobbyMusic.song);
    await expect.poll(async () => (await music()).time).toBeGreaterThan(0.15);
    await guest.getByLabel('Your name').fill('PRACTICED');
    await guest.getByLabel('Your name').press('Enter');
    await expect(host.locator('#room-racers')).toContainText('PRACTICED');
    await host.locator('[data-room-track="1"]').click();
    await guest.getByRole('button', { name: 'FREE RIDE', exact: true }).click();
    await expect.poll(async () => (await state(guest)).state).toBe('freeride');
    expect((await music()).song).toBe('Horizon Lane');
    await host.getByRole('button', { name: 'START RACE', exact: true }).click();
    await expect(guest.locator('#countdown')).toBeVisible();
    expect((await music()).song).toBe('Neon Slipway');
    expect((await state(guest)).track.id).toBe('harbor');
    expect((await state(guest)).player.passed).toBe(0);
    await expect(guest.locator('#practice-controls')).toBeHidden();
    await expect(guest.locator('.room-code-panel')).toBeHidden();
    await expect(guest.locator('.race-top')).toBeVisible();
    await expect.poll(async () => (await state(guest)).state).toBe('racing');
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('real WebRTC item commands are owned by the host and effects reach the guest', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const host = await context.newPage(),
    guest = await context.newPage();
  try {
    for (const page of [host, guest]) await page.goto('/e2e/fixtures/multiplayer.html');
    await host.evaluate(() => room.open(true, 'HOST'));
    await expect.poll(() => host.evaluate(() => room.phase)).toBe('lobby');
    const code = await host.evaluate(() => room.code);
    await guest.evaluate((code) => room.open(false, 'GUEST', code), code);
    await expect.poll(() => host.evaluate(() => room.members.length)).toBe(2);
    await host.evaluate(() => room.start());
    await expect.poll(() => guest.evaluate(() => room.race?.countdown)).toBe(0);
    for (const item of [1, 2, 3, 4, 5, 6]) {
      await guest.evaluate(() => Object.assign(drive, { use: false }));
      await expect.poll(() => host.evaluate(() => room.race!.racers[1].itemPressed)).toBe(false);
      await host.evaluate(async (item) => {
        const path = '/src/game/physics.ts',
          waterPath = '/src/game/water.ts';
        const { createRacer } = await import(path),
          { waterHeight } = await import(waterPath);
        const race = room.race!;
        race.items.state.effects = [];
        for (const r of race.racers)
          Object.assign(r, createRacer(race.track, r.id), {
            x: -100,
            z: -150 - r.id * 15,
            y: waterHeight(-100, -150 - r.id * 15, race.tick / 120, race.track) + 0.6,
            yaw: 0,
          });
        race.racers[1].item = item;
      }, item);
      await expect.poll(() => guest.evaluate(() => room.race!.player.item)).toBe(item);
      await guest.evaluate(() => Object.assign(drive, { use: true }));
      await expect.poll(() => host.evaluate(() => room.race!.racers[1].item)).toBe(0);
      await expect.poll(() => guest.evaluate(() => room.race!.player.item)).toBe(0);
      if (item === 4 || item === 5) {
        expect(await guest.evaluate(() => room.race!.player.boost)).toBeGreaterThan(0);
      } else {
        await expect
          .poll(() =>
            guest.evaluate(() => room.race!.items.state.effects.some((e) => e.owner === 1)),
          )
          .toBe(true);
        if (item === 3 || item === 6)
          await expect
            .poll(() =>
              guest.evaluate(() =>
                room.race!.items.state.effects.some(
                  (e) => e.owner === 1 && e.launch && Number.isFinite(e.launch.y),
                ),
              ),
            )
            .toBe(true);
      }
    }
  } finally {
    await context.close();
  }
});

test('rider labels follow interpolated craft on every rendered frame', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const host = await context.newPage(),
    guest = await context.newPage();
  try {
    await openOnline(host);
    await expect(host.locator('#online-lobby')).toBeVisible();
    const code = await host.locator('#room-code').inputValue();
    await openOnline(guest, 'JOIN');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'JOIN ROOM' }).click();
    await expect(guest.locator('#room-count')).toHaveText('2 RACERS');
    await expect(guest.getByLabel('Your name')).toHaveValue('');
    await expect(guest.getByLabel('Your name')).toHaveAttribute('placeholder', 'RACER 2');
    await expect(guest.locator('#room-racers')).toContainText('RACER 1');
    await expect(guest.locator('#room-racers')).toContainText('RACER 2');
    await guest.getByLabel('Your name').fill('WAVE RUNNER');
    await guest.getByLabel('Your name').press('Enter');
    await expect(host.locator('#room-racers')).toContainText('WAVE RUNNER');
    await guest.getByLabel('Your name').fill('');
    await guest.getByLabel('Your name').press('Enter');
    await expect(host.locator('#room-racers')).toContainText('RACER 2');
    await expect(guest.getByLabel('Your name')).toHaveValue('');

    await host.getByRole('button', { name: 'FREE RIDE', exact: true }).click();
    await host.keyboard.down('w');
    await expect.poll(async () => (await state(host)).speed).toBeGreaterThan(15);
    const samples = await guest.evaluate(async () => {
      const path = '/src/game/engine.ts';
      const { Engine } = await import(path);
      const original = Engine.prototype.lobbyLabels;
      const measured: { error: number; rawGap: number }[] = [];
      // Compare the actual label's screen anchor to the mesh rendered by the same frame.
      Engine.prototype.lobbyLabels = function () {
        const labels = original.call(this);
        const position = labels.find((p: { id: number }) => p.id === 0);
        if (position?.visible) {
          const mesh = this.jets[0];
          const expected = mesh.position.clone();
          expected.y += 3.6;
          expected.project(this.camera);
          const x = ((expected.x + 1) * innerWidth) / 2;
          const y = ((1 - expected.y) * innerHeight) / 2;
          const rawGap = mesh.position.distanceTo({ ...this.racers[0] });
          queueMicrotask(() => {
            const label = document.querySelector<HTMLElement>('#lobby-labels [data-slot="0"]')!;
            const rect = label.getBoundingClientRect();
            measured.push({
              error: Math.hypot(rect.x + rect.width / 2 - x, rect.bottom - y),
              rawGap,
            });
          });
        }
        return labels;
      };
      await new Promise<void>((resolve) => {
        let frames = 0;
        const next = () => (++frames >= 30 ? resolve() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      });
      Engine.prototype.lobbyLabels = original;
      return measured;
    });
    expect(samples.length).toBeGreaterThanOrEqual(27);
    expect(Math.max(...samples.map((s) => s.error))).toBeLessThan(0.1);
    expect(Math.max(...samples.map((s) => s.rawGap))).toBeGreaterThan(0.05);
    await guest.screenshot({ path: 'artifacts/multiplayer-labels-moving.png' });
    await host.keyboard.up('w');
  } finally {
    await context.close();
  }
});

test('finishers keep riding, live results fill in, and the host returns everyone to the same lobby', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const host = await context.newPage(),
    guest = await context.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) {
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__testEngine = engine;',
      });
    });
  }
  try {
    await openOnline(host);
    await expect(host.locator('#online-lobby')).toBeVisible();
    await expect(host.locator('#room-code')).toHaveValue(/^[A-Z2-9]{8}$/);
    const code = await host.locator('#room-code').inputValue();
    await openOnline(guest, 'JOIN');
    await guest.getByLabel('Racer name').fill('FINISHER');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'JOIN ROOM' }).click();
    await expect(host.locator('#room-count')).toHaveText('2 RACERS');
    await host.getByRole('button', { name: 'START RACE', exact: true }).click();
    await expect.poll(async () => (await state(guest)).state).toBe('racing');
    const finish = async (id: number) =>
      host.evaluate((id) => {
        const e = (window as any).__testEngine,
          race = e.network,
          r = race.racers[id],
          g = race.track.gates[0];
        race.tick = 360 + (180 + id * 10) * 120;
        Object.assign(r, {
          x: g.x - g.tx * 0.05,
          z: g.z - g.tz * 0.05,
          vx: g.tx * 12,
          vz: g.tz * 12,
          yaw: Math.atan2(g.tx, g.tz),
          nextGate: 0,
          lap: 3,
          laps: [60, 60],
          lapStart: 120,
        });
      }, id);
    await finish(0);
    await expect(host.locator('#results')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('#race-results li')).toHaveCount(2);
    await expect(host.locator('[data-racer="1"] strong')).toHaveText('RACING');
    const hostTime = await host.locator('[data-racer="0"] strong').textContent();
    await finish(1);
    await expect(guest.locator('#results')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('[data-racer="1"] strong')).toContainText('03:10.');
    await expect(guest.locator('[data-racer="1"] strong')).toHaveText(
      (await host.locator('[data-racer="1"] strong').textContent()) ?? '',
    );
    const before = (await state(guest)).player;
    await guest.waitForTimeout(700);
    const after = (await state(guest)).player;
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(2);
    expect(after.finishTime).toBe(before.finishTime);
    await expect(host.locator('[data-racer="0"] strong')).toHaveText(hostTime!);
    await host.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
    for (const page of [host, guest]) {
      await expect(page.locator('#online-lobby')).toBeVisible();
      await expect(page.locator('#results')).not.toBeVisible();
      await expect(page.locator('#room-code')).toHaveValue(code);
      await expect(page.locator('#room-count')).toHaveText('2 RACERS');
      await expect(page.locator('#room-racers')).toContainText('FINISHER');
    }
    await host.getByRole('button', { name: 'START RACE', exact: true }).click();
    await expect.poll(async () => (await state(guest)).state).toBe('racing');
    expect((await state(guest)).player.laps).toEqual([]);
    await host.keyboard.press('Escape');
    await host.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
    await expect(guest.locator('#online-lobby')).toBeVisible();
    await expect(host.locator('#room-code')).toHaveValue(code);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('copied room links join directly and failed clipboard writes expose the full link', async ({
  browser,
  baseURL,
}) => {
  const hostContext = await browser.newContext({
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const guestContext = await browser.newContext({ reducedMotion: 'reduce' });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', (error) => errors.push(error.message));
  try {
    await openOnline(host);
    await expect(host.locator('#online-lobby')).toBeVisible();
    const code = await host.locator('#room-code').inputValue();
    await expect(host.locator('.room-address')).toHaveText('vectide.thebuilder.dk');
    const codeBox = (await host.locator('#room-code').boundingBox())!;
    const address = (await host.locator('.room-address').boundingBox())!;
    expect(address.y).toBeGreaterThanOrEqual(codeBox.y + codeBox.height);
    await host.getByRole('button', { name: 'Copy room join link' }).click();
    await expect(host.locator('#copy-room')).toHaveText('COPIED');
    const link = await host.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(`https://vectide.thebuilder.dk/?join=${code}`);
    // Serve the invitation from the local build and its local signaling server.
    const invitation = new URL(link);
    await guest.goto(`${baseURL}${invitation.pathname}${invitation.search}`);
    await expect(guest.locator('#online-lobby')).toBeVisible();
    await expect(guest.locator('#online-dialog')).not.toBeVisible();
    await expect(guest.locator('#room-code')).toHaveValue(code);
    await expect(host.locator('#room-count')).toHaveText('2 RACERS');
    expect(new URL(guest.url()).searchParams.has('join')).toBe(false);
    await guest.getByLabel('Your name').fill('INVITED');
    await guest.getByLabel('Your name').press('Enter');
    await expect(host.locator('#room-racers')).toContainText('INVITED');
    await guest.getByRole('button', { name: 'Leave room' }).click();
    await guest.reload();
    await expect(guest.locator('#menu-home')).toBeVisible();
    await expect(guest.locator('#online-dialog')).not.toBeVisible();
    await host.evaluate(() => {
      Object.defineProperty(navigator.clipboard, 'writeText', {
        value: async () => {
          throw new Error('Clipboard denied');
        },
      });
    });
    await host.getByRole('button', { name: 'Copy room join link' }).click();
    await expect(host.getByLabel('Room join link', { exact: true })).toBeVisible();
    await expect(host.getByLabel('Room join link', { exact: true })).toHaveValue(link);
    expect(
      await host
        .getByLabel('Room join link', { exact: true })
        .evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart!, el.selectionEnd!)),
    ).toBe(link);
    await expect(host.locator('#lobby-status')).toContainText('copy the join link');
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('invalid invitation codes show a recoverable join form', async ({ page }) => {
  await page.goto('/?join=INVALID');
  await expect(page.locator('#online-dialog')).toBeVisible();
  await expect(page.locator('#online-status')).toHaveText('Enter the eight-character room code.');
  await expect(page.locator('#join-code')).toHaveValue('INVALID');
  await expect(page.locator('#join-room')).toBeVisible();
  await page.locator('#cancel-online').click();
  await expect(page.locator('#menu-home')).toBeVisible();
});
