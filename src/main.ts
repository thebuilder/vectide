import { formatTime, setupResults } from './results';
import { StuntHud } from './stunt-hud';
import './stunt-hud.css';
import { PickupHud } from './pickup-hud';
import { CheckpointGuide } from './checkpoint-guide';
import { RideCoach } from './ride-coach';
import './ride-coach.css';
import { rideHelp, setupRideHelp } from './ride-help';
import './pickups.css';
import { courseCards } from './course-cards';
import { setupMultiplayer } from './multiplayer/ui';
import { inject } from '@vercel/analytics';
import { TouchControls } from './touch';
import '@fontsource/roboto/latin-900-italic.css';
import '@fontsource/roboto/latin-400-italic.css';
import '@fontsource/roboto/latin-700.css';
import { Controls } from './controls';
import './style.css';
import './multiplayer/style.css';
import './menu.css';
import './checkpoint-guide.css';
import { setupMenuScreens } from './menu';
import { Engine, type Mode, type Snapshot } from './game/engine';
import { TRACKS } from './game/tracks';

inject();

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<canvas id="ocean" aria-label="Vectide 3D jet ski racing game"></canvas>
<div class="screen-grain" aria-hidden="true"></div>
<header class="masthead"><a class="wordmark" href="/" aria-label="Vectide home"><img src="/logo.svg" width="570" height="99" alt=""/><span class="version">/ 01</span></a><div class="header-right"><span id="header-label">WATER RACING SYSTEM</span><button id="sound" class="quiet" aria-pressed="false" aria-label="Enable engine sound"><svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5Z"/><path class="speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="speaker-muted" d="m15 9 6 6m0-6-6 6"/></svg><span id="sound-label">SOUND OFF</span></button><button id="pause" class="quiet" aria-label="Pause" title="Pause (Esc)" hidden><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg></button></div></header>
<main id="menu">
  <div id="menu-panels">
  <section id="menu-home" class="menu-screen is-active" aria-label="Main menu">
  <div class="hero"><p class="eyebrow">ANALOG SOUL. DIGITAL OCEAN.</p><h1>RIDE THE<br/><span>WAVEFORM.</span></h1><p class="intro">Find your line. Feel every wave.</p></div>
  <div class="home-actions"><button id="open-setup" class="primary">HIT THE WATER <svg width="34" height="24" viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m3 5 7 7-7 7m10-14 7 7-7 7m10-14 7 7-7 7"/></svg></button>
    <div class="multiplayer-launch"><span class="eyebrow">MULTIPLAYER</span><div><button id="host-online">HOST</button><button id="join-online">JOIN</button></div></div>
  </div></section>
  <section id="race-setup" class="menu-screen" aria-label="Race setup" inert>
  <div class="launch"><div class="setup-scroll"><div class="setup-heading"><button id="setup-back" class="quiet">BACK</button><h2>Set your course.</h2></div>
    <div class="course-heading"><span>SELECT COURSE</span><span id="course-number">01 / 03</span></div>
    <div class="courses">${courseCards('data-track')}</div>
    <div class="course-description"><span id="description">${TRACKS[0].description}</span><span id="lap-estimate">~1 MIN / LAP</span></div>
    <div class="setup-options">
      <div class="setup-option"><span id="difficulty-heading">DIFFICULTY</span><div class="difficulty-toggle" role="group" aria-labelledby="difficulty-heading" aria-describedby="difficulty-description">${['easy', 'normal', 'expert'].map((d) => `<button type="button" data-difficulty="${d}" aria-pressed="${d === 'normal'}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div></div>
      <div class="setup-option"><span id="pickups-heading">PICKUPS</span><button id="pickups-toggle" class="pickup-toggle" aria-labelledby="pickups-heading pickups-toggle" aria-pressed="true">ON</button></div>
    </div>
    <p id="difficulty-description">Sporting opponents. Your handling stays the same.</p></div>
    <div class="launch-row"><div class="mode-switch" aria-label="Race mode"><button data-mode="race" class="active" aria-pressed="true">RACE <small>6 RIDERS · 3 LAPS</small></button><button data-mode="trial" aria-pressed="false">TIME TRIAL <small>SOLO · 1 LAP</small></button></div><button id="start" class="primary">START RACE</button></div>
  </div></section>
  </div>
  <footer class="menu-footer"><a class="creator-credit" href="https://thebuilder.dk/" target="_blank" rel="noopener noreferrer">by thebuilder.dk</a><span data-keyboard="WASD / ARROWS · NAVIGATE & RIDE · ENTER SELECT" data-touch="TOUCH TO SELECT · SLIDE STICK TO STEER & LEAN" data-gamepad="D-PAD / STICK · NAVIGATE · A SELECT · B BACK">WASD / ARROWS · NAVIGATE & RIDE · ENTER SELECT</span><button id="help" class="quiet">HOW TO RIDE <span>+</span></button></footer>
</main>
<section id="hud" hidden aria-label="Race information">
  <div class="race-top"><div><span class="label" id="position-label">POSITION</span><strong id="position">01<span>/ 06</span></strong></div><div class="lap-info"><span class="label">LAP <b id="lap">1 / 3</b></span><strong id="timer">00:00.000</strong></div></div>
  <div id="checkpoint" class="checkpoint" role="img" aria-label="Next gate"><span id="direction" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 7-7 7 7M5 20l7-7 7 7"/></svg></span></div>
  <div id="item-hud" hidden><span id="item-icon" aria-hidden="true">◇</span><div><strong id="item-name" aria-hidden="true"></strong><span id="item-announcement" class="sr-only" role="status"></span><small id="item-description">Ride through a pickup</small><span id="item-use"><span class="item-use-label"><kbd data-keyboard="Q" data-gamepad="LB" data-touch="USE button">Q</kbd> USE ITEM</span></span></div></div>
  <div id="notice" class="notice" role="status"></div>
  <div class="race-bottom"><div class="map-wrap"><canvas id="map" width="220" height="190" aria-label="Course map"></canvas><span id="track-name">PALM CIRCUIT</span></div><div class="speed"><strong id="speed">0</strong><span>KM/H</span><div class="speed-bar"><i id="speed-fill"></i></div><small id="water-state">ON THE WATER</small></div></div>
  <div id="online-race-status" hidden></div>
  <div class="race-help"><kbd data-keyboard="R" data-touch="RESET button" data-gamepad="X">R</kbd> RESET <span>·</span> <kbd data-keyboard="HOLD E" data-touch="HOLD JUMP" data-gamepad="HOLD RB">HOLD E</kbd> PREPARE · RELEASE AT TAKEOFF · LEAN TO ROTATE</div>
</section>
<aside id="ride-coach" hidden aria-label="Driving tip"><kbd class="coach-key"></kbd><span class="coach-text"></span><button aria-label="Dismiss driving tips">×</button></aside>
<div id="touch-controls" aria-label="Touch driving controls">
 <div class="touch-navigation"><button data-touch-key="reset" hidden>RESET</button><div class="touch-stick-wrap"><button data-touch-key="stick" class="touch-stick" aria-label="Slide to steer and lean" aria-describedby="stick-help"><span class="stick-axis" aria-hidden="true"></span><span class="stick-thumb" aria-hidden="true"></span></button><span id="stick-help">STEER / LEAN</span></div></div>
 <div class="touch-actions"><button data-touch-key="item" hidden aria-label="Use item">USE</button><div><button data-touch-key="brake">BRAKE</button><button data-touch-key="flip">JUMP</button></div></div>
</div>
<div id="stunt-hud" aria-hidden="true" hidden></div>
<div id="stunt-announcement" class="sr-only" role="status" aria-atomic="true"></div>
<div id="lap-split" role="status" aria-live="polite" aria-atomic="true"></div>
<div id="countdown" hidden aria-live="polite"></div>
<dialog id="pause-dialog"><span class="eyebrow">TAKE A BREATHER</span><h2 id="pause-title">Water can wait.</h2><p id="pause-note"></p><div class="pause-volume"><label for="sounds-volume"><span>SOUNDS</span><output id="sounds-volume-value" for="sounds-volume"></output></label><input id="sounds-volume" type="range" min="0" max="100" step="1" /><label for="music-volume"><span>MUSIC</span><output id="music-volume-value" for="music-volume"></output></label><input id="music-volume" type="range" min="0" max="100" step="1" /></div><button autofocus id="resume" class="primary">KEEP RIDING <svg width="34" height="24" viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m3 5 7 7-7 7m10-14 7 7-7 7m10-14 7 7-7 7"/></svg></button><button id="restart" class="secondary">RESTART RACE</button><button id="exit" class="quiet">BACK TO COURSES</button><button id="pause-help" class="quiet">CONTROLS</button></dialog>
${rideHelp}
<dialog id="results" aria-labelledby="result-title"><span class="eyebrow" id="result-label">FINISH LINE</span><h2 id="result-title">Made some waves.</h2><div class="result-time" id="result-time"></div><div id="lap-results"></div><p id="best-result"></p><ol id="race-results" aria-label="Race positions" hidden></ol><p id="result-ride-note">AUTOPILOT · ENJOY THE RIDE</p><button id="again" class="primary">RIDE AGAIN</button><button id="result-exit" class="quiet">BACK TO COURSES</button></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const results = setupResults($<HTMLOListElement>('race-results'), $('result-title'));
let mode: Mode = 'race';
const introElements = [
  ['.masthead', 0.03],
  ['.hero', 0.12],
  ['.home-actions', 0.18],
  ['.menu-footer', 0.23],
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
for (const channel of ['sounds', 'music'] as const) {
  const slider = $<HTMLInputElement>(`${channel}-volume`);
  const output = $<HTMLOutputElement>(`${channel}-volume-value`);
  slider.value = String(Math.round(engine.audio.volumes[channel] * 100));
  const syncVolume = () => {
    output.value = `${slider.value}%`;
    slider.setAttribute('aria-valuetext', output.value);
  };
  syncVolume();
  slider.oninput = () => {
    engine.audio.setVolume(channel, slider.valueAsNumber / 100);
    syncVolume();
  };
}
const touch = new TouchControls(engine, $('touch-controls'));
const controls = new Controls(engine);
const rideCoach = new RideCoach($('ride-coach'));
$('pickups-toggle').onclick = () => {
  engine.pickupsEnabled = !engine.pickupsEnabled;
  $('pickups-toggle').setAttribute('aria-pressed', String(engine.pickupsEnabled));
  $('pickups-toggle').textContent = engine.pickupsEnabled ? 'ON' : 'OFF';
};
const stuntHud = new StuntHud($('stunt-hud'), $('stunt-announcement'));
const pickupHud = new PickupHud($('item-hud'));
const checkpointGuide = new CheckpointGuide($('checkpoint'));
engine.onFrame = (now) => {
  controls.poll(now);
  stuntHud.update(engine.player, ['racing', 'freeride', 'paused'].includes(engine.state));
  pickupHud.update(
    engine.player,
    (engine.network?.items ?? engine.items).enabled && ['racing', 'paused'].includes(engine.state),
  );
};
document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(
  (button) =>
    (button.onclick = () => {
      engine.difficulty = button.dataset.difficulty as typeof engine.difficulty;
      $('difficulty-description').textContent = {
        easy: 'Slower opponents. Your handling stays the same.',
        normal: 'Sporting opponents. Your handling stays the same.',
        expert: 'Faster opponents. Your handling stays the same.',
      }[engine.difficulty];
      document
        .querySelectorAll('[data-difficulty]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    }),
);
const menuScreens = setupMenuScreens();
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
    $('lap-estimate').textContent = '~1 MIN / LAP';
    $('course-number').textContent = `0${selectedTrack + 1} / 03`;
  }),
);
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) =>
  button.addEventListener('click', () => {
    mode = button.dataset.mode as Mode;
    $<HTMLButtonElement>('pickups-toggle').disabled = mode === 'trial';
    $('pickups-toggle').textContent =
      mode === 'trial' ? 'OFF · TIME TRIAL' : engine.pickupsEnabled ? 'ON' : 'OFF';
    $('pickups-toggle').setAttribute(
      'aria-pressed',
      String(mode === 'race' && engine.pickupsEnabled),
    );
    $('start').textContent = mode === 'trial' ? 'START TIME TRIAL' : 'START RACE';
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
  results.clear();
  stuntHud.clear();
  shownLaps = 0;
  splitUntil = 0;
  $('lap-split').classList.remove('is-visible');
}
function showRace() {
  clearFinishPresentation();
  void engine.audio.start();
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('pause').hidden = false;
  document.body.classList.add('playing');
  $('start').blur();
}
function start() {
  showRace();
  engine.start(mode);
}
function menu(screen: 'home' | 'setup' = 'setup') {
  multiplayer.room.close();
  clearFinishPresentation();
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  engine.menu();
  if (engine.track !== TRACKS[selectedTrack]) engine.selectTrack(selectedTrack);
  $('menu').hidden = false;
  $('hud').hidden = true;
  $('pause').hidden = true;
  $('countdown').hidden = true;
  document.body.classList.remove('playing');
  menuScreens.show(screen, false);
}
$('start').onclick = start;
$('restart').onclick = start;
$('again').onclick = start;
const exitRace = () => {
  if (engine.network && multiplayer.room.host) multiplayer.room.returnToLobby();
  else menu(engine.network ? 'home' : 'setup');
};
$('exit').onclick = exitRace;
$('result-exit').onclick = exitRace;
$('pause').onclick = () => engine.pause();
$('resume').onclick = () => engine.pause();
setupRideHelp();
$('sound').onclick = async () => {
  if (!engine.audio.enabled || engine.audio.error) await engine.audio.start();
  else engine.audio.mute();
};
$<HTMLDialogElement>('pause-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  if (engine.state === 'paused' || engine.onlineMenuOpen) engine.pause();
});
engine.onPause = () => {
  const dialog = $<HTMLDialogElement>('pause-dialog');
  if (engine.state === 'paused' || engine.onlineMenuOpen) {
    if (!dialog.open) dialog.showModal();
  } else dialog.close();
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
    .filter((r) => !engine.network?.disconnected.has(r.id))
    .forEach((r) => {
      map.fillStyle = r.color;
      map.beginPath();
      map.arc(x(r.x), z(r.z), r.id === s.player.id ? 4 : 2.5, 0, Math.PI * 2);
      map.fill();
    });
}
engine.onUpdate = (s) => {
  multiplayer.update();
  results.update(s, engine.network?.disconnected);
  syncIntro(engine.introStatus.progress);
  touch.sync(s);
  rideCoach.update(s, engine.drivingInput);
  if (s.player.laps.length > shownLaps) {
    shownLaps = s.player.laps.length;
    const latest = s.player.laps[shownLaps - 1];
    const previous = s.player.laps[shownLaps - 2];
    const difference = previous === undefined ? undefined : Math.round((latest - previous) * 100);
    const comparison =
      difference === undefined || difference === 0 ? 'even' : difference < 0 ? 'faster' : 'slower';
    const delta =
      difference === undefined
        ? ''
        : `<span class="lap-split-delta"><strong>${difference === 0 ? '±' : difference < 0 ? '−' : '+'}${(Math.abs(difference) / 100).toFixed(2)}s</strong><small>${comparison.toUpperCase()}</small></span>`;
    $('lap-split').dataset.comparison = comparison;
    $('lap-split').innerHTML =
      `<span class="lap-split-label">LAP ${shownLaps}</span><strong class="lap-split-time">${formatTime(latest)}</strong>${delta}`;
    splitUntil = performance.now() + 3200;
  }
  $('lap-split').classList.toggle(
    'is-visible',
    ['racing', 'finished'].includes(s.state) && performance.now() < splitUntil,
  );
  const audio = engine.audio.status;
  $('sound-label').textContent = audio.error || (audio.enabled ? 'SOUND ON' : 'SOUND OFF');
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').setAttribute(
    'aria-label',
    audio.error || (audio.enabled ? 'Mute soundtrack and engine' : 'Enable soundtrack and engine'),
  );
  $('sound').title = audio.song;
  if (s.state === 'menu') {
    $('header-label').textContent = 'WATER RACING SYSTEM';
    return;
  }
  $('header-label').textContent = s.track.name;
  $('position-label').textContent = s.mode === 'trial' ? 'TIME TRIAL' : 'POSITION';
  $('position').innerHTML =
    s.mode === 'trial'
      ? 'SOLO'
      : `${s.position.toString().padStart(2, '0')}<span>/ ${String(s.racers.length).padStart(2, '0')}</span>`;
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
        : '';
  const go = s.state === 'racing' && s.time < 0.75;
  $('countdown').hidden = s.state !== 'countdown' && !go;
  $('countdown').textContent = go ? 'GO!' : String(Math.max(1, Math.ceil(s.countdown)));
  $('countdown').classList.toggle('go', go);
  drawMap(s);
};
engine.onFinish = (s) => {
  engine.audio.finish();
  const best = Math.min(...s.player.laps),
    courseVersion = s.track.id === 'storm' ? 'v12' : s.track.id === 'palms' ? 'v8' : 'v9',
    key = `vectide:best:${courseVersion}:${s.track.id}:${engine.network ? 'online' : s.mode}${(engine.network?.items ?? engine.items).enabled ? ':pickups' : ''}`;
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
    s.mode === 'race' ? `POSITION ${s.position} / ${s.racers.length}` : 'TIME TRIAL COMPLETE';
  $('result-title').removeAttribute('aria-label');
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
        ? `NEW LOCAL BEST LAP · ${formatTime(best)}${Number.isFinite(previous) ? ` · ${(previous - best).toFixed(2)}s FASTER` : ''}`
        : `LOCAL BEST LAP · ${formatTime(previous)} · ${(best - previous).toFixed(2)}s TO BEAT`;
  finishTimer = setTimeout(() => {
    if (engine.state === 'finished') {
      $<HTMLDialogElement>('results').showModal();
      results.reveal();
    }
  }, 1800);
};
const multiplayer = setupMultiplayer(
  engine,
  (race) => {
    showRace();
    engine.startNetwork(race);
  },
  () => menu('home'),
  () => {
    clearFinishPresentation();
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
    $('hud').hidden = true;
    $('pause').hidden = true;
    $('countdown').hidden = true;
    document.body.classList.remove('playing');
  },
);
engine.onRender = () => {
  multiplayer.render();
  checkpointGuide.render(engine);
};
// Read-only diagnostics support reproducible browser verification without altering race state.
Object.defineProperty(window, '__vectide', {
  get: () =>
    structuredClone({
      ...engine.snapshot(),
      pickups: {
        enabled: (engine.network?.items ?? engine.items).enabled,
        boxes: (engine.network?.items ?? engine.items).boxes,
        ...(engine.network?.items ?? engine.items).state,
      },
      multiplayer: {
        phase: multiplayer.room.phase,
        host: multiplayer.room.host,
        slot: multiplayer.room.slot,
        members: multiplayer.room.members,
        pendingInputs: engine.network?.pendingCount ?? 0,
      },
      rider: engine.riderPose,
      audio: engine.audio.status,
      intro: engine.introStatus,
      sprayCount: engine.sprayCount,
      renderer: engine.renderer.info.render,
      checkpointGuide: checkpointGuide.state,
    }),
});

multiplayer.joinFromLink();
