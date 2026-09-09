import { inject } from '@vercel/analytics';
import { TouchControls } from './touch';
import '@fontsource/roboto/latin-900-italic.css';
import '@fontsource/roboto/latin-400-italic.css';
import '@fontsource/roboto/latin-700.css';
import { Controls } from './controls';
import './style.css';
import { Engine, type Mode, type Snapshot } from './game/engine';
import { SONGS } from './game/audio';
import { TRACKS } from './game/tracks';

inject();

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<canvas id="ocean" aria-label="Vectide 3D jet ski racing game"></canvas>
<div class="screen-grain" aria-hidden="true"></div>
<header class="masthead"><a class="wordmark" href="/" aria-label="Vectide home"><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M1 2h9l10 21L30 2h9L20 39Z"/><path d="M0 13h40M0 19h40" class="cut"/></svg>VECTIDE<span class="version">/ 01</span></a><div class="header-right"><span id="header-label">WATER RACING SYSTEM</span><button id="sound" class="quiet" aria-pressed="false" aria-label="Enable engine sound">SOUND OFF</button><button id="pause" class="quiet" hidden>PAUSE <kbd data-keyboard="ESC" data-touch="PAUSE" data-gamepad="START">ESC</kbd></button></div></header>
<main id="menu">
  <div class="hero"><p class="eyebrow">ANALOG SOUL. DIGITAL OCEAN.</p><h1>RIDE THE<br/><span>WAVEFORM.</span></h1><p class="intro">Find your line. Feel every wave.</p></div>
  <section class="launch" aria-label="Race setup">
    <div class="course-heading"><span>SELECT COURSE</span><span id="course-number">01 / 03</span></div>
    <div class="courses">${TRACKS.map(
      (t, i) =>
        `<button class="course ${i === 0 ? 'selected' : ''}" data-track="${i}" aria-pressed="${i === 0}"><span class="course-index">0${i + 1}</span><span class="course-name">${t.name}<small>${t.sea} WATER</small></span><svg class="course-line" viewBox="${Math.min(...t.points.map((p) => p.x)) - 20} ${Math.min(...t.points.map((p) => p.z)) - 20} ${Math.max(...t.points.map((p) => p.x)) - Math.min(...t.points.map((p) => p.x)) + 40} ${Math.max(...t.points.map((p) => p.z)) - Math.min(...t.points.map((p) => p.z)) + 40}" aria-hidden="true"><path d="M${t.points
          .filter((_, i) => i % 8 === 0)
          .map((p) => `${p.x},${p.z}`)
          .join('L')}Z"/></svg></button>`,
    ).join('')}</div>
    <div class="course-description"><span id="description">${TRACKS[0].description}</span><span>~2 MIN / LAP</span></div>
    <div class="setup-options">
      <div class="setup-option"><span id="soundtrack-heading">SOUNDTRACK</span><details class="song-picker"><summary id="soundtrack-label" aria-labelledby="soundtrack-heading soundtrack-label">${SONGS[0].name}</summary><div class="song-options" role="group" aria-label="Race soundtrack">${SONGS.map((s, i) => `<button type="button" data-song="${i}" aria-pressed="${i === 0}">${s.name}</button>`).join('')}</div></details></div>
      <div class="setup-option"><span id="difficulty-heading">DIFFICULTY</span><div class="difficulty-toggle" role="group" aria-labelledby="difficulty-heading">${['easy', 'normal', 'expert'].map((d) => `<button type="button" data-difficulty="${d}" aria-pressed="${d === 'normal'}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div></div>
    </div>
    <div class="launch-row"><div class="mode-switch" aria-label="Race mode"><button data-mode="race" class="active" aria-pressed="true">RACE <small>6 RIDERS · 3 LAPS</small></button><button data-mode="trial" aria-pressed="false">TIME TRIAL <small>SOLO · 1 LAP</small></button></div><button id="start" class="primary">HIT THE WATER <svg width="34" height="24" viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m3 5 7 7-7 7m10-14 7 7-7 7m10-14 7 7-7 7"/></svg></button></div>
  </section>
  <footer class="menu-footer"><a class="creator-credit" href="https://thebuilder.dk/" target="_blank" rel="noopener noreferrer">by thebuilder.dk</a><button id="replay-intro" class="quiet">REPLAY INTRO</button><span data-keyboard="WASD / ARROWS · NAVIGATE & RIDE · ENTER SELECT" data-touch="TOUCH TO SELECT · VIRTUAL KEYS TO RIDE" data-gamepad="D-PAD / STICK · NAVIGATE · A SELECT · B BACK">WASD / ARROWS · NAVIGATE & RIDE · ENTER SELECT</span><button id="help" class="quiet">HOW TO RIDE <span>+</span></button></footer>
</main>
<section id="hud" hidden aria-label="Race information">
  <div class="race-top"><div><span class="label" id="position-label">POSITION</span><strong id="position">01<span>/ 06</span></strong></div><div class="lap-info"><span class="label">LAP <b id="lap">1 / 3</b></span><strong id="timer">00:00.000</strong></div></div>
  <div id="checkpoint" class="checkpoint"><span id="direction">↑</span><div>NEXT GATE <b id="gate">01</b><small id="distance">0 M</small></div></div>
  <div id="notice" class="notice" role="status"></div>
  <div class="race-bottom"><div class="map-wrap"><canvas id="map" width="220" height="190" aria-label="Course map"></canvas><span id="track-name">PALM CIRCUIT</span></div><div class="speed"><strong id="speed">0</strong><span>KM/H</span><div class="speed-bar"><i id="speed-fill"></i></div><small id="water-state">ON THE WATER</small></div></div>
  <div class="race-help"><kbd data-keyboard="R" data-touch="RESET button" data-gamepad="X">R</kbd> RESET <span>·</span> <kbd data-keyboard="HOLD E" data-touch="SWIPE + HOLD GO" data-gamepad="HOLD RB">HOLD E</kbd> PREPARE STUNT · RELEASE AT TAKEOFF</div>
</section>
<div id="touch-controls" aria-label="Touch driving controls">
 <div class="touch-steer"><button data-touch-key="left" aria-label="Steer left">◀</button><button data-touch-key="right" aria-label="Steer right">▶</button></div>
 <div class="touch-actions"><button data-touch-key="reset" hidden>RESET</button><div><button data-touch-key="brake">BRAKE</button><button data-touch-key="throttle">GO</button></div></div>
</div>
<div id="lap-split" hidden role="status" aria-live="polite"></div>
<div id="countdown" hidden aria-live="polite"></div>
<dialog id="pause-dialog"><span class="eyebrow">TAKE A BREATHER</span><h2>Water can wait.</h2><button id="resume" class="primary">KEEP RIDING <svg width="34" height="24" viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m3 5 7 7-7 7m10-14 7 7-7 7m10-14 7 7-7 7"/></svg></button><button id="restart" class="secondary">RESTART RACE</button><button id="exit" class="quiet">BACK TO COURSES</button></dialog>
<dialog id="help-dialog"><span class="eyebrow">THE QUICK BRIEFING</span><h2>Ride the water.</h2><p>Pass between each pair of glowing buoys, in order. The next gate is marked on your map.</p><dl><dt data-keyboard="W / ↑" data-touch="GO button" data-gamepad="RT">W / ↑</dt><dd>Throttle</dd><dt data-keyboard="A D / ← →" data-touch="◀ / ▶ buttons" data-gamepad="LEFT STICK">A D / ← →</dt><dd>Steer and carve</dd><dt data-keyboard="S / SPACE" data-touch="BRAKE button" data-gamepad="LT">S / SPACE</dt><dd>Brake for tight turns</dd><dt class="touch-hide" data-keyboard="SHIFT / C" data-gamepad="STICK ↑ / ↓">SHIFT / C</dt><dd class="touch-hide">Shift weight back / forward</dd><dt data-keyboard="E / STEER + E" data-touch="SWIPE + HOLD GO" data-gamepad="RB / STICK + RB">E / STEER + E</dt><dd>Hold to load a flip; steer to load a spin. Release at takeoff.</dd><dt data-keyboard="R" data-touch="RESET button" data-gamepad="X">R</dt><dd>Reset to the last checkpoint</dd><dt data-keyboard="ESC" data-touch="PAUSE" data-gamepad="START">ESC</dt><dd>Pause</dd></dl><p>Gamepad: left stick to steer, right trigger for throttle, left trigger to brake. Pull the stick back to lift the nose, or forward to press it down.</p><p>Ease into a turn. Keep the hull planted for grip. Use wave crests and amber ramps to jump. Hold E (gamepad RB) as you approach a jump, then release at takeoff. On touch, swipe up from GO and hold to load a flip, or sideways for a spin; lift your finger at takeoff. An unfinished trick can throw you off; you will swim back and remount.</p><button id="close-help" class="primary">GOT IT <span>↗</span></button></dialog>
<dialog id="results"><span class="eyebrow" id="result-label">FINISH LINE</span><h2 id="result-title">Made some waves.</h2><div class="result-time" id="result-time"></div><div id="lap-results"></div><p id="best-result"></p><button id="again" class="primary">RIDE AGAIN <span>↗</span></button><button id="result-exit" class="quiet">BACK TO COURSES</button></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const formatTime = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, '0')}:${(time % 60).toFixed(3).padStart(6, '0')}`;
let mode: Mode = 'race';
const introElements = [
  ['.masthead', 0.08],
  ['.hero', 0.5],
  ['.course-heading', 0.6],
  ['.courses', 0.62],
  ['.course-description', 0.64],
  ['.setup-options', 0.66],
  ['.launch-row', 0.68],
  ['.menu-footer', 0.7],
].map(([selector, at]) => ({
  element: document.querySelector<HTMLElement>(String(selector))!,
  at: Number(at),
}));
function syncIntro(progress: number) {
  for (const { element, at } of introElements) {
    element.classList.add('intro-stage');
    element.classList.toggle('intro-visible', progress >= at);
    element.inert = progress < at;
  }
}
syncIntro(matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0);
let engine: Engine;
try {
  engine = new Engine($<HTMLCanvasElement>('ocean'));
} catch (error) {
  syncIntro(1);
  $('menu').innerHTML =
    '<div class="hero"><h1>Ocean offline.</h1><p>Your browser could not start WebGL. Enable hardware acceleration and reload to ride.</p></div>';
  throw error;
}
const touch = new TouchControls(engine, $('touch-controls'));
const controls = new Controls(engine);
engine.onFrame = (now) => controls.poll(now);
document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(
  (button) =>
    (button.onclick = () => {
      engine.difficulty = button.dataset.difficulty as typeof engine.difficulty;
      document
        .querySelectorAll('[data-difficulty]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    }),
);
document.querySelectorAll<HTMLButtonElement>('[data-song]').forEach(
  (button) =>
    (button.onclick = () => {
      engine.audio.select(Number(button.dataset.song));
      document.querySelector<HTMLDetailsElement>('.song-picker')!.open = false;
    }),
);
document.addEventListener('click', (event) => {
  const picker = document.querySelector<HTMLDetailsElement>('.song-picker')!;
  if (!picker.contains(event.target as Node)) picker.open = false;
});
document.querySelector('.song-picker')!.addEventListener('keydown', (event) => {
  if ((event as KeyboardEvent).key === 'Escape') {
    document.querySelector<HTMLDetailsElement>('.song-picker')!.open = false;
    $('soundtrack-label').focus();
  }
});
let selectedTrack = 0;
document.querySelectorAll<HTMLButtonElement>('[data-track]').forEach((button) =>
  button.addEventListener('click', () => {
    selectedTrack = Number(button.dataset.track);
    engine.selectTrack(selectedTrack);
    document.querySelectorAll('[data-track]').forEach((b) => {
      const active = b === button;
      b.classList.toggle('selected', active);
      b.setAttribute('aria-pressed', String(active));
    });
    $('description').textContent = TRACKS[selectedTrack].description;
    $('course-number').textContent = `0${selectedTrack + 1} / 03`;
  }),
);
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) =>
  button.addEventListener('click', () => {
    mode = button.dataset.mode as Mode;
    document.querySelectorAll('[data-mode]').forEach((b) => {
      const active = b === button;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }),
);
let finishTimer: ReturnType<typeof setTimeout> | undefined;
let shownLaps = 0;
let splitUntil = 0;
function clearFinishPresentation() {
  clearTimeout(finishTimer);
  shownLaps = 0;
  splitUntil = 0;
  $('lap-split').hidden = true;
}
function start() {
  clearFinishPresentation();
  void engine.audio.start();
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('pause').hidden = false;
  document.body.classList.add('playing');
  engine.start(mode);
  $('start').blur();
}
function menu() {
  clearFinishPresentation();
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  engine.menu();
  $('menu').hidden = false;
  $('hud').hidden = true;
  $('pause').hidden = true;
  $('countdown').hidden = true;
  document.body.classList.remove('playing');
  $('start').focus();
}
$('replay-intro').onclick = () => {
  engine.replayIntro();
  syncIntro(engine.introStatus.progress);
};
$('start').onclick = start;
$('restart').onclick = start;
$('again').onclick = start;
$('exit').onclick = menu;
$('result-exit').onclick = menu;
$('pause').onclick = () => engine.pause();
$('resume').onclick = () => engine.pause();
$('help').onclick = () => $<HTMLDialogElement>('help-dialog').showModal();
$('close-help').onclick = () => $<HTMLDialogElement>('help-dialog').close();
$('sound').onclick = async () => {
  if (!engine.audio.enabled || engine.audio.error) await engine.audio.start();
  else engine.audio.mute();
};
$<HTMLDialogElement>('pause-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  if (engine.state === 'paused') engine.pause();
});
engine.onPause = () => {
  const dialog = $<HTMLDialogElement>('pause-dialog');
  if (engine.state === 'paused') dialog.showModal();
  else dialog.close();
};
const map = $<HTMLCanvasElement>('map').getContext('2d')!;
function drawMap(s: Snapshot) {
  const points = s.track.points;
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minZ = Math.min(...points.map((p) => p.z)),
    maxZ = Math.max(...points.map((p) => p.z));
  const scale = Math.min(190 / (maxX - minX), 150 / (maxZ - minZ));
  const x = (v: number) => 15 + (v - minX) * scale,
    z = (v: number) => 15 + (v - minZ) * scale;
  map.clearRect(0, 0, 220, 190);
  map.lineWidth = 8;
  map.strokeStyle = '#86fadd16';
  map.beginPath();
  points.forEach((p, i) => (i === 0 ? map.moveTo(x(p.x), z(p.z)) : map.lineTo(x(p.x), z(p.z))));
  map.closePath();
  map.stroke();
  map.lineWidth = 1;
  map.strokeStyle = '#86fadd66';
  map.stroke();
  const gate = s.track.gates[s.player.nextGate];
  map.strokeStyle = '#ffbc57';
  map.lineWidth = 2;
  map.beginPath();
  map.arc(x(gate.x), z(gate.z), 6, 0, Math.PI * 2);
  map.stroke();
  s.racers
    .slice()
    .reverse()
    .forEach((r) => {
      map.fillStyle = r.color;
      map.beginPath();
      map.arc(x(r.x), z(r.z), r.id === 0 ? 4 : 2.5, 0, Math.PI * 2);
      map.fill();
    });
}
engine.onUpdate = (s) => {
  syncIntro(engine.introStatus.progress);
  touch.sync(s);
  if (s.player.laps.length > shownLaps) {
    shownLaps = s.player.laps.length;
    const latest = s.player.laps[shownLaps - 1];
    const previous = s.player.laps[shownLaps - 2];
    const delta =
      previous === undefined
        ? ''
        : ` · ${latest < previous ? '−' : '+'}${Math.abs(latest - previous).toFixed(2)}s`;
    $('lap-split').textContent = `LAP ${shownLaps} · ${formatTime(latest)}${delta}`;
    splitUntil = performance.now() + 3200;
  }
  $('lap-split').hidden =
    !['racing', 'finished'].includes(s.state) || performance.now() > splitUntil;
  const audio = engine.audio.status;
  $('sound').textContent = audio.error || (audio.enabled ? 'SOUND ON' : 'SOUND OFF');
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').setAttribute(
    'aria-label',
    audio.enabled ? 'Mute soundtrack and engine' : 'Enable soundtrack and engine',
  );
  $('sound').title = audio.song;
  $('soundtrack-label').textContent = SONGS[engine.audio.song].name;
  document
    .querySelectorAll<HTMLButtonElement>('[data-song]')
    .forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.song) === engine.audio.song)),
    );
  if (s.state === 'menu') {
    $('header-label').textContent = 'WATER RACING SYSTEM';
    return;
  }
  $('header-label').textContent = s.track.name;
  $('position-label').textContent = s.mode === 'trial' ? 'TIME TRIAL' : 'POSITION';
  $('position').innerHTML =
    s.mode === 'trial' ? 'SOLO' : `${s.position.toString().padStart(2, '0')}<span>/ 06</span>`;
  $('lap').textContent =
    `${Math.min(Math.max(s.player.lap, 1), s.mode === 'race' ? 3 : 1)} / ${s.mode === 'race' ? 3 : 1}`;
  $('timer').textContent = formatTime(s.time);
  $('speed').textContent = String(Math.round(s.speed));
  $('speed-fill').style.width = `${Math.min(s.speed, 100)}%`;
  $('water-state').textContent = s.player.onRamp
    ? 'ON THE RAMP'
    : s.player.wet === 0
      ? 'AIRBORNE'
      : s.track.sea + ' WATER';
  $('track-name').textContent = s.track.name;
  const gate = s.track.gates[s.player.nextGate];
  const d = Math.hypot(gate.x - s.player.x, gate.z - s.player.z);
  $('gate').textContent = String(s.player.nextGate + 1).padStart(2, '0');
  $('distance').textContent = `${Math.round(d)} M`;
  const turn = Math.atan2(
    Math.sin(Math.atan2(gate.x - s.player.x, gate.z - s.player.z) - s.player.yaw),
    Math.cos(Math.atan2(gate.x - s.player.x, gate.z - s.player.z) - s.player.yaw),
  );
  $('direction').style.transform = `rotate(${-turn}rad)`;
  const recovery = s.player.recovery.phase;
  $('notice').textContent =
    recovery !== 'riding'
      ? recovery === 'remounting'
        ? 'CLIMBING BACK ON'
        : 'RIDER DOWN'
      : s.missed
        ? document.body.dataset.input === 'touch'
          ? 'MISSED GATE · TURN BACK OR TAP RESET'
          : document.body.dataset.input === 'gamepad'
            ? 'MISSED GATE · TURN BACK OR PRESS X'
            : 'MISSED GATE · TURN BACK OR PRESS R'
        : s.player.air.trick !== 'none'
          ? s.player.air.trick.toUpperCase()
          : s.player.air.messageTime > 0
            ? s.player.air.message
            : '';
  const go = s.state === 'racing' && s.time < 0.75;
  $('countdown').hidden = s.state !== 'countdown' && !go;
  $('countdown').textContent = go ? 'GO!' : String(Math.max(1, Math.ceil(s.countdown)));
  $('countdown').classList.toggle('go', go);
  drawMap(s);
};
engine.onFinish = (s) => {
  const best = Math.min(...s.player.laps),
    key = `vectide:best:v5:${s.track.id}:${s.mode}`;
  let previous = Infinity,
    saved = true;
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? Infinity : Number(raw);
    previous = Number.isFinite(value) && value > 0 ? value : Infinity;
    if (best < previous && !s.player.recovered) localStorage.setItem(key, String(best));
  } catch {
    saved = false;
  }
  $('result-label').textContent =
    s.mode === 'race' ? `POSITION ${s.position} / 6` : 'TIME TRIAL COMPLETE';
  $('result-title').textContent =
    s.mode === 'race' && s.position === 1 ? 'You own the water.' : 'Made some waves.';
  $('result-time').textContent = formatTime(s.time);
  $('lap-results').innerHTML = s.player.laps
    .map((t, i) => `<div><span>LAP ${i + 1}</span><strong>${formatTime(t)}</strong></div>`)
    .join('');
  $('best-result').textContent = s.player.recovered
    ? 'RECOVERED RUN · EXCLUDED FROM LOCAL BEST'
    : !saved
      ? 'Best time could not be saved in this browser.'
      : best < previous
        ? `NEW LOCAL BEST LAP · ${formatTime(best)}`
        : `LOCAL BEST LAP · ${formatTime(previous)}`;
  finishTimer = setTimeout(() => {
    if (engine.state === 'finished') $<HTMLDialogElement>('results').showModal();
  }, 1800);
};
// Read-only diagnostics support reproducible browser verification without altering race state.
Object.defineProperty(window, '__vectide', {
  get: () =>
    structuredClone({
      ...engine.snapshot(),
      rider: engine.riderPose,
      audio: engine.audio.status,
      intro: engine.introStatus,
      sprayCount: engine.sprayCount,
      renderer: engine.renderer.info.render,
    }),
});
