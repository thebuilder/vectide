import { expect, test } from '@playwright/test';

for (const track of [0, 1, 2]) {
  test(`music reaches the racing surface and wake on course ${track}`, async ({ page }) => {
    test.setTimeout(45000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text());
    });
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__testEngine = engine;',
      });
    });
    await page.goto('/');
    await page.locator('#open-setup').click();
    await page.locator('#sound').click();
    await page.locator(`[data-track="${track}"]`).click();
    await page.locator('#start').click();
    await page.waitForFunction(() => (window as any).__vectide.state === 'racing');
    await page.evaluate(async () => {
      const path = '/src/game/physics.ts',
        { aiInput } = await import(path);
      const e = (window as any).__testEngine;
      e.input = () => aiInput(e.player, e.track, e.racers);
    });
    const result = await page.evaluate(async () => {
      const e = (window as any).__testEngine,
        frames: number[] = [],
        beats = new Set<number>();
      let active = 0,
        shape = 0,
        wake = 0,
        checkpointPulse = 0,
        checkpointMotion = 0,
        inactiveCheckpointMotion = 0,
        previous = performance.now();
      for (let i = 0; i < 600; i++) {
        const now = await new Promise<number>((r) => requestAnimationFrame(r));
        frames.push(now - previous);
        previous = now;
        beats.add(e.audio.spectrum.beat);
        const uniforms = e.world.waterMaterial.uniforms;
        if (uniforms.uMusicGlint.value > 0.1) active++;
        shape = Math.max(
          shape,
          ...Array.from(uniforms.uMusicWaveform.value as Float32Array).map(Math.abs),
        );
        wake = Math.max(wake, e.wake.object.material.uniforms.uMusic.value.x);
        const post = e.world.gates[e.player.nextGate].getObjectByName('buoy');
        checkpointPulse = Math.max(
          checkpointPulse,
          post.getObjectByName('beacon-ring').scale.x - 1,
        );
        checkpointMotion = Math.max(
          checkpointMotion,
          Math.abs(post.getObjectByName('flag').geometry.getAttribute('position').getZ(20)),
        );
        const following = e.world.gates[(e.player.nextGate + 1) % e.world.gates.length];
        inactiveCheckpointMotion = Math.max(
          inactiveCheckpointMotion,
          Math.abs(following.getObjectByName('beacon-ring').rotation.y),
        );
      }
      frames.sort((a, b) => a - b);
      return {
        beats: beats.size,
        active,
        shape,
        wake,
        checkpointPulse,
        checkpointMotion,
        inactiveCheckpointMotion,
        p95: frames[Math.floor(frames.length * 0.95)],
        song: e.audio.status.song,
      };
    });
    console.log(`music surface ${track}`, result);
    expect(result.beats).toBeGreaterThan(3);
    // Songs have different rhythmic density; require a visible response without prescribing a tempo.
    expect(result.active).toBeGreaterThan(0);
    expect(result.shape).toBeGreaterThan(0.03);
    expect(result.wake).toBeGreaterThan(0.1);
    expect(result.checkpointPulse).toBeGreaterThan(0.05);
    expect(result.checkpointMotion).toBeGreaterThan(0.05);
    expect(result.inactiveCheckpointMotion).toBe(0);
    if (process.env.PLAYWRIGHT_GPU) expect(result.p95).toBeLessThan(34);
    await page.screenshot({ path: `artifacts/music-surface-${track}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const e = (window as any).__testEngine;
          return (
            e.world.waterMaterial.uniforms.uMusicGlint.value === 0 &&
            e.wake.object.material.uniforms.uMusic.value.length() === 0 &&
            e.world.gates[e.player.nextGate].getObjectByName('beacon-ring').rotation.y === 0 &&
            e.world.gates[e.player.nextGate].getObjectByName('beacon-ring').scale.x === 1
          );
        }),
      )
      .toBe(true);
    expect(
      await page.evaluate(async () => {
        const e = (window as any).__testEngine;
        const vertices = e.world.gates[e.player.nextGate]
          .getObjectByName('flag')
          .geometry.getAttribute('position');
        const still = Array.from(vertices.array);
        for (let i = 0; i < 15; i++) await new Promise(requestAnimationFrame);
        return still.every((value, i) => value === vertices.array[i]);
      }),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#pause').click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const e = (window as any).__testEngine;
          return !e.audio.status.playing && e.world.waterMaterial.uniforms.uMusicGlint.value === 0;
        }),
      )
      .toBe(true);
    await page.locator('#resume').click();
    await page.evaluate(() => (window as any).__testEngine.audio.setVolume('music', 0));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const e = (window as any).__testEngine;
          return (
            e.world.waterMaterial.uniforms.uMusicGlint.value === 0 &&
            e.audio.spectrum.bands.low < 0.01 &&
            e.wake.object.material.uniforms.uMusic.value.length() < 0.02 &&
            e.world.gates[e.player.nextGate].getObjectByName('beacon-ring').scale.x === 1
          );
        }),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}
