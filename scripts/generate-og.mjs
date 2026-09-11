import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  args: process.env.PLAYWRIGHT_GPU ? [`--use-angle=${process.env.PLAYWRIGHT_GPU}`] : [],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(process.env.VECTIDE_PREVIEW_URL ?? 'http://127.0.0.1:5173');
  // Render a dedicated still using the production models, without race traffic or HUD.
  const scene = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { createJet, animateJet } = await import('/src/game/jets.ts');
    const { createWorld } = await import('/src/game/visuals.ts');
    const { TRACKS } = await import('/src/game/tracks.ts');
    const { createRacer } = await import('/src/game/physics.ts');
    const { waterHeight } = await import('/src/game/water.ts');
    const track = { ...TRACKS[0], wave: 0.75 };
    const world = createWorld(track);
    // Keep the sky, striped sun, near ocean and horizon. Set pieces stay out of the portrait.
    world.group.remove(world.ramps);
    for (const child of [...world.group.children].slice(4)) world.group.remove(child);
    const scene = new T.Scene();
    scene.add(world.group, new T.HemisphereLight(0xbcefff, 0x294247, 3));
    const key = new T.DirectionalLight(0xffd6bc, 4);
    key.position.set(8, 12, 10);
    scene.add(key);
    const rim = new T.DirectionalLight(0x86fadd, 3);
    rim.position.set(-8, 5, -6);
    scene.add(rim);
    const camera = new T.PerspectiveCamera(37, 1200 / 630, 0.1, 7000);
    camera.position.set(10, 4.8, 15);
    camera.lookAt(-3.2, 0.7, 0);
    const sun = world.group.children[1];
    camera.updateMatrixWorld();
    sun.position.copy(
      new T.Vector3(0.62, 0.63, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()
        .multiplyScalar(800)
        .add(camera.position),
    );
    sun.scale.setScalar(0.25);
    sun.lookAt(camera.position);
    for (const [i, pose] of [
      { x: 1.4, z: 1.8, yaw: -0.5, color: '#86fadd' },
      { x: 3.3, z: -2.6, yaw: -0.85, color: '#ff668f' },
    ].entries()) {
      const jet = createJet(pose.color, i + 1);
      const racer = createRacer(track, i);
      Object.assign(racer, { steer: 0, wet: 1, roll: 0, pitch: 0, vx: 0, vz: 0 });
      for (let n = 0; n < 60; n++) animateJet(jet, racer, 1 / 60);
      jet.position.set(pose.x, waterHeight(pose.x, pose.z, 0, track.wave) + 0.38, pose.z);
      jet.scale.setScalar(1.35);
      jet.rotation.y = pose.yaw;
      scene.add(jet);
    }
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1200, 630);
    renderer.setPixelRatio(1);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL('image/png');
    world.dispose();
    renderer.dispose();
    return image;
  });
  const titleFont = (
    await readFile(
      new URL(
        '../node_modules/@fontsource/roboto/files/roboto-latin-900-italic.woff2',
        import.meta.url,
      ),
    )
  ).toString('base64');
  const logo = (await readFile(new URL('../public/logo.svg', import.meta.url))).toString('base64');
  await page.setContent(`<!doctype html><html><head><style>@font-face{font-family:Roboto;src:url(data:font/woff2;base64,${titleFont}) format('woff2');font-weight:900;font-style:italic;}</style></head><body style="margin:0;background:#071b20;color:#eefbf5;font-family:Arial,sans-serif">
    <img src="${scene}" style="position:absolute;width:1200px;height:630px">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,12,20,.93),rgba(3,12,20,.45) 38%,transparent 62%),linear-gradient(0deg,rgba(3,12,20,.94),transparent 24%)"></div>
    <img src="data:image/svg+xml;base64,${logo}" alt="Vectide" height="56" style="position:absolute;left:54px;top:44px">
    <div style="position:absolute;left:56px;top:210px;font-family:Roboto,Arial,sans-serif;font-synthesis:none;font-size:68px;line-height:1;font-weight:900;font-style:italic;letter-spacing:-3px">RIDE THE<br><span style="color:#86fadd">WAVEFORM.</span></div>
    <div style="position:absolute;left:58px;bottom:153px;font:16px monospace;letter-spacing:2px;color:#bce0d5">NEON JET SKI RACING</div>
    <div style="position:absolute;left:58px;bottom:47px;font:700 26px monospace;letter-spacing:.5px;color:#eefbf5">vectide.thebuilder.dk</div>
  </body></html>`);
  await page
    .locator('img')
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/og.png' });
} finally {
  await browser.close();
}
