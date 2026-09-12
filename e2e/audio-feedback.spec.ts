import { test, expect } from '@playwright/test';

test('33 percent is a quiet music level in the actual playback graph', async ({ page }) => {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testAudio = engine.audio;',
    });
  });
  await page.goto('/');
  await page.locator('#sound').click();
  const levels = await page.evaluate(async () => {
    const audio = (window as any).__testAudio;
    audio.music.pause();
    // Feed a constant reference into the same gain and analyser as music. A changing song
    // cannot reliably distinguish volume changes from differences between its beats.
    const reference = audio.context.createOscillator();
    reference.frequency.value = 440;
    const input = audio.context.createGain();
    input.gain.value = 0.1;
    reference.connect(input).connect(audio.musicGain);
    reference.start();
    const results: number[] = [];
    for (const level of [1, 0.66, 0.33, 0]) {
      audio.setVolume('music', level);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const samples = new Float32Array(audio.analyser.fftSize);
      audio.analyser.getFloatTimeDomainData(samples);
      results.push(Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length));
    }
    reference.stop();
    reference.disconnect();
    input.disconnect();
    return results;
  });
  expect(levels[0]).toBeGreaterThan(0.03);
  expect(levels[0]).toBeLessThan(0.04);
  expect(levels[1] / levels[0]).toBeCloseTo(0.4356, 2);
  expect(levels[2] / levels[0]).toBeCloseTo(0.1089, 2);
  expect(levels[3]).toBeLessThan(0.00001);
});

test('motor is quieter than the old buzz and every item produces a bounded cue', async ({
  page,
}) => {
  await page.goto('/');
  const audio = await page.evaluate(async () => {
    const enginePath = '/src/game/engine-audio.ts',
      effectsPath = '/src/game/sound-effects.ts';
    const [{ EngineAudio }, { SoundEffects }] = await Promise.all([
      import(enginePath),
      import(effectsPath),
    ]);
    const rms = (samples: Float32Array) =>
      Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
    const renderMotor = async (legacy: boolean, throttle = 1, contact = 1, boost = 0) => {
      const context = new OfflineAudioContext(1, 48000, 48000);
      if (legacy) {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 42 + 25 * 4 + 20;
        filter.type = 'lowpass';
        filter.frequency.value = 1100;
        gain.gain.value = 0.155;
        oscillator.connect(filter).connect(gain).connect(context.destination);
        oscillator.start();
      } else {
        const effects = new SoundEffects(context, context.destination);
        const motor = new EngineAudio(context, context.destination, effects.noise);
        motor.update(25, throttle, true, contact, boost);
      }
      const buffer = await context.startRendering();
      return rms(buffer.getChannelData(0).slice(24000));
    };
    const cues = [];
    for (let item = 0; item <= 6; item++) {
      const context = new OfflineAudioContext(1, 48000, 48000);
      const effects = new SoundEffects(context, context.destination);
      if (item === 0) effects.pickup();
      else effects.useItem(item);
      const buffer = await context.startRendering();
      const samples = buffer.getChannelData(0);
      cues.push({
        rms: rms(samples),
        peak: samples.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0),
        tail: rms(samples.slice(40000)),
      });
    }
    return {
      old: await renderMotor(true),
      cruise: await renderMotor(false),
      coasting: await renderMotor(false, 0),
      airborne: await renderMotor(false, 1, 0),
      boost: await renderMotor(false, 1, 1, 1),
      cues,
    };
  });
  expect(audio.cruise).toBeLessThan(audio.old * 0.25);
  expect(audio.cruise).toBeGreaterThan(0.003);
  expect(audio.coasting).toBeLessThan(audio.cruise);
  expect(audio.airborne).toBeLessThan(audio.cruise);
  expect(audio.boost).toBeGreaterThan(audio.cruise * 1.1);
  for (const cue of audio.cues) {
    expect(cue.rms).toBeGreaterThan(0.004);
    expect(cue.peak).toBeLessThan(0.5);
    expect(cue.tail).toBeLessThan(0.00001);
  }
  console.log('Measured audio RMS:', audio);
});

test('real pickup use triggers sound and boosts lengthen the visible stern exhaust', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
  await page.waitForFunction(() => (window as any).__testEngine.state === 'racing');
  await page.evaluate(async () => {
    const e = (window as any).__testEngine;
    const physicsPath = '/src/game/physics.ts',
      waterPath = '/src/game/water.ts';
    const [{ aiInput }, { waterHeight }] = await Promise.all([
      import(physicsPath),
      import(waterPath),
    ]);
    e.input = () => ({
      ...aiInput(e.player, e.track, e.racers),
      throttle: 1,
      use: (window as any).__useItem ?? false,
    });
    const calls: (string | number)[] = [];
    (window as any).__audioCalls = calls;
    const pickup = e.audio.pickup.bind(e.audio),
      useItem = e.audio.useItem.bind(e.audio);
    e.audio.pickup = () => {
      calls.push('pickup');
      pickup();
    };
    e.audio.useItem = (item: number) => {
      calls.push(item);
      useItem(item);
    };
    // Run the normal collection and use code from a real pickup row.
    const box = e.items.boxes[2];
    const gateIndex = e.track.gates.reduce(
      (best: number, gate: any, index: number) =>
        Math.hypot(gate.x - box.x, gate.z - box.z) <
        Math.hypot(e.track.gates[best].x - box.x, e.track.gates[best].z - box.z)
          ? index
          : best,
      0,
    );
    const gate = e.track.gates[gateIndex];
    Object.assign(e.player, {
      x: box.x,
      z: box.z,
      y: waterHeight(box.x, box.z, e.visualTime, e.track) + 0.6,
      vx: gate.tx * 18,
      vz: gate.tz * 18,
      yaw: Math.atan2(gate.tx, gate.tz),
      nextGate: (gateIndex + 1) % e.track.gates.length,
      passed: gateIndex + 1,
      item: 0,
    });
    e.racers.slice(1).forEach((r: any) => {
      r.passed = 50;
    });
    e.items.random = () => 0.7; // A trailing racer receives Wake Boost from this roll.
  });
  await expect.poll(() => page.evaluate(() => (window as any).__audioCalls)).toEqual(['pickup']);
  await page.waitForFunction(() => (window as any).__testEngine.player.itemReadyIn === 0);
  const item = await page.evaluate(() => (window as any).__testEngine.player.item);
  expect(item).toBe(5);
  const plume = () =>
    page.evaluate(() => {
      const e = (window as any).__testEngine;
      const exhaust = e.jets[e.racers.indexOf(e.player)].getObjectByName('jet-exhaust');
      return { visible: exhaust.visible, length: exhaust.scale.z };
    });
  await expect.poll(async () => (await plume()).length).toBeGreaterThan(0.8);
  await page.screenshot({ path: testInfo.outputPath('cruising-exhaust.png') });
  const cruising = (await plume()).length;
  await page.evaluate(() => {
    (window as any).__useItem = true;
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__audioCalls))
    .toEqual(['pickup', item]);
  await expect.poll(async () => (await plume()).length).toBeGreaterThan(cruising * 1.65);
  await page.screenshot({ path: testInfo.outputPath('boost-exhaust.png') });
  await page.evaluate(() => {
    (window as any).__testEngine.input = () => ({ throttle: 0, brake: 1, steer: 0, lean: 0 });
  });
  await expect.poll(async () => (await plume()).visible).toBe(false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('#restart').click();
  expect(await page.evaluate(() => (window as any).__audioCalls)).toEqual(['pickup', item]);
  expect(errors).toEqual([]);
});

test('foreground cues remain audible against each course soundtrack at the default mix', async ({
  page,
}) => {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testAudio = engine.audio;',
    });
  });
  await page.goto('/');
  await page.locator('#sound').click();
  const mix = await page.evaluate(async () => {
    const audio = (window as any).__testAudio;
    audio.music.pause();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const effectsPath = '/src/game/sound-effects.ts';
    const { SoundEffects } = await import(effectsPath);
    const rms = (samples: Float32Array) =>
      Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const tracks = [];
    for (const song of ['sapphire-wake', 'apex-runner', 'chrome-horizon']) {
      const file = await (await fetch(`/music/${song}.mp3`)).arrayBuffer();
      const buffer = await audio.context.decodeAudioData(file);
      const samples = buffer
        .getChannelData(0)
        .slice(buffer.sampleRate * 10, buffer.sampleRate * 20);
      tracks.push(rms(samples) * audio.musicGain.gain.value);
    }
    const cues = [];
    for (let item = 0; item <= 6; item++) {
      const context = new OfflineAudioContext(1, 48000, 48000);
      const effects = new SoundEffects(context, context.destination);
      if (item === 0) effects.pickup();
      else effects.useItem(item);
      const samples = (await context.startRendering()).getChannelData(0);
      cues.push({
        attack: rms(samples.slice(1200, 7200)) * audio.soundsGain.gain.value,
        peak:
          samples.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0) *
          audio.soundsGain.gain.value,
      });
    }
    return { defaults: audio.volumes, tracks, cues };
  });
  expect(mix.defaults).toEqual({ sounds: 1, music: 0.6 });
  for (const cue of mix.cues) {
    expect(cue.attack).toBeGreaterThan(Math.max(...mix.tracks) * 0.9);
    expect(cue.peak).toBeGreaterThan(Math.max(...mix.tracks) * 3);
    expect(cue.peak).toBeLessThan(0.5);
  }
  console.log('Default mix RMS:', mix);
});

test('finish sting renders with a bounded peak and decays to silence', async ({ page }) => {
  await page.goto('/');
  const cue = await page.evaluate(async () => {
    const path = '/src/game/sound-effects.ts',
      { SoundEffects } = await import(path);
    const context = new OfflineAudioContext(1, 72000, 48000);
    new SoundEffects(context, context.destination).finish();
    const samples = (await context.startRendering()).getChannelData(0);
    return {
      peak: samples.reduce((p, v) => Math.max(p, Math.abs(v)), 0),
      energy: samples.reduce((n, v) => n + v * v, 0),
      tail: samples.slice(60000).reduce((n, v) => n + Math.abs(v), 0),
    };
  });
  expect(cue.peak).toBeGreaterThan(0.03);
  expect(cue.peak).toBeLessThan(0.5);
  expect(cue.energy).toBeGreaterThan(1);
  expect(cue.tail).toBe(0);
});
