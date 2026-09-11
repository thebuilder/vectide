import { test, expect } from '@playwright/test';

test('pause sliders independently control audio and remember the mix', async ({ page }) => {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testAudio = engine.audio;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toHaveText('');
  await pause.click();
  await expect(page.locator('#resume')).toBeFocused();
  const sounds = page.getByRole('slider', { name: 'SOUNDS' });
  const music = page.getByRole('slider', { name: 'MUSIC' });
  await expect(sounds).toHaveValue('100');
  await expect(music).toHaveValue('32');
  await sounds.focus();
  await page.keyboard.press('Home');
  await music.focus();
  await page.keyboard.press('End');
  await expect(sounds).toHaveAttribute('aria-valuetext', '0%');
  await expect(page.locator('#music-volume-value')).toHaveText('100%');
  await page.evaluate(() => {
    const audio = (window as any).__testAudio;
    const analyser = audio.context.createAnalyser();
    audio.soundsGain.connect(analyser);
    (window as any).__soundsAnalyser = analyser;
  });
  const energy = () =>
    page.evaluate(() => {
      const rms = (analyser: AnalyserNode) => {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      };
      return {
        sounds: rms((window as any).__soundsAnalyser),
        music: rms((window as any).__testAudio.analyser),
      };
    });
  await page.locator('#resume').click();
  await expect.poll(async () => (await energy()).music).toBeGreaterThan(0.005);
  // Exercise every effect path while the sounds channel is silent.
  await page.evaluate(() => {
    const audio = (window as any).__testAudio;
    audio.explosion();
    audio.countdownCue(true);
    audio.tone(440, 1);
  });
  await expect.poll(async () => (await energy()).sounds).toBeLessThan(0.00001);
  await pause.click();
  await sounds.focus();
  await page.keyboard.press('End');
  await music.focus();
  await page.keyboard.press('Home');
  await page.locator('#resume').click();
  await expect.poll(async () => (await energy()).sounds, { timeout: 10000 }).toBeGreaterThan(0.005);
  await expect.poll(async () => (await energy()).music).toBeLessThan(0.00001);
  await page.locator('#sound').click();
  await expect.poll(async () => (await energy()).sounds).toBeLessThan(0.00001);
  await pause.click();
  await music.focus();
  await page.keyboard.press('End');
  await page.locator('#resume').click();
  await expect.poll(async () => (await energy()).music).toBeLessThan(0.00001);
  await page.locator('#sound').click();
  await expect.poll(async () => (await energy()).music).toBeGreaterThan(0.005);
  await pause.click();
  await sounds.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.reload();
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  await pause.click();
  await expect(sounds).toHaveValue('1');
  await expect(music).toHaveValue('100');
});

test('mobile pause controls fit and allow pointer adjustment', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#open-setup').tap();
  await page.locator('#start').tap();
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  const sounds = page.getByRole('slider', { name: 'SOUNDS' });
  const bounds = (await sounds.boundingBox())!;
  await page.touchscreen.tap(bounds.x + bounds.width * 0.4, bounds.y + bounds.height / 2);
  expect(Number(await sounds.inputValue())).toBeGreaterThan(30);
  expect(Number(await sounds.inputValue())).toBeLessThan(50);
  await expect(page.getByRole('slider', { name: 'MUSIC' })).toHaveValue('32');
  const dialog = (await page.locator('#pause-dialog').boundingBox())!;
  expect(dialog.x).toBeGreaterThanOrEqual(0);
  expect(dialog.y).toBeGreaterThanOrEqual(0);
  expect(dialog.y + dialog.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: testInfo.outputPath('mobile-pause.png') });
  await page.locator('#resume').tap();
  await expect(page.locator('#pause-dialog')).toBeHidden();
  await context.close();
});
