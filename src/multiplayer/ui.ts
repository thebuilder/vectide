import { courseCards } from '../course-cards';
import type { Engine } from '../game/engine';
import { raceProgress } from '../game/physics';
import { TRACKS } from '../game/tracks';
import type { NetworkRace } from './race';
import { Room } from './room';
import { COLORS } from './protocol';

export function setupMultiplayer(
  engine: Engine,
  begin: (race: NetworkRace) => void,
  exit: () => void,
) {
  const room = new Room();
  const dialog = document.createElement('dialog');
  dialog.id = 'online-dialog';
  dialog.setAttribute('aria-labelledby', 'online-title');
  dialog.innerHTML = `<span class="eyebrow">MULTIPLAYER</span><h2 id="online-title">Join your friends.</h2>
    <form id="join-form"><div id="online-entry"><label>Racer name<input id="racer-name" maxlength="20" autocomplete="nickname" value="RACER"></label>
    <label>Room code<input id="join-code" maxlength="8" minlength="8" pattern="[A-Za-z2-9]{8}" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label><button id="join-room" class="primary">JOIN ROOM <span aria-hidden="true">→</span></button></div></form>
    <p id="online-status" role="status"></p><button id="cancel-online" class="quiet">BACK</button>`;
  const lobby = document.createElement('section');
  lobby.id = 'online-lobby';
  lobby.hidden = true;
  lobby.setAttribute('aria-label', 'Multiplayer lobby');
  lobby.innerHTML = `<div class="lobby-heading"><section class="room-code-panel" aria-label="Share room"><span class="eyebrow">ROOM CODE</span><div class="room-code-row"><input id="room-code" readonly aria-label="Share this room code"><button id="copy-room" class="quiet" aria-live="polite">COPY</button></div></section><div id="practice-controls" hidden><div><span class="eyebrow">FREE RIDE</span><p>Practice while the host gets ready.</p></div><button id="leave-practice" class="quiet">BACK TO LOBBY</button></div></div>
    <div id="lobby-labels" aria-hidden="true"></div>
    <div class="lobby-bottom"><section id="room-courses" aria-label="Room course"><div class="course-heading"><span id="room-course-heading">SELECT COURSE</span><span id="room-course-number">01 / 03</span></div><div class="courses">${courseCards('data-room-track')}</div></section>
    <div class="lobby-panel"><div class="lobby-crew"><span id="room-count" class="eyebrow"></span><ol id="room-racers" aria-label="Racers in room"></ol><button id="room-pickups" class="pickup-toggle" aria-pressed="true">PICKUPS ON</button><button id="leave-room" class="quiet" aria-label="Leave room" title="Leave room"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4h9v16h-9M14 12H3m4-4-4 4 4 4"/></svg><span>LEAVE ROOM</span></button></div>
    <div class="lobby-settings"><label>Your name<input id="profile-name" maxlength="20" autocomplete="nickname" value="RACER"></label>
    <fieldset class="color-picker"><legend>Craft color</legend>${COLORS.map((color, i) => `<button type="button" data-color="${i}" style="--craft-color:${color}" aria-label="${['Mint', 'Pink', 'Gold', 'Violet', 'Blue', 'White', 'Lime', 'Rose', 'Aqua', 'Orange'][i]}" aria-pressed="false"></button>`).join('')}</fieldset>
    </div>
    <div class="lobby-launch"><p id="lobby-status" role="status"></p><div class="lobby-actions"><button id="enter-practice" class="secondary">FREE RIDE</button><button id="start-room" class="primary">START RACE <svg width="26" height="20" viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m3 5 7 7-7 7m10-14 7 7-7 7m10-14 7 7-7 7"/></svg></button></div></div></div></div>`;
  document.body.append(dialog, lobby);
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const input = (id: string) => el<HTMLInputElement>(id);
  const button = (id: string) => el<HTMLButtonElement>(id);
  const status = el('online-status');
  let entryAction = 'join-online';
  let name = 'RACER';
  const show = () => {
    if (!dialog.open) dialog.showModal();
  };
  const hideLobby = () => {
    lobby.hidden = true;
    document.body.classList.remove('in-lobby', 'in-free-ride');
    el('practice-controls').hidden = true;
  };
  const positionLabels = () => {
    if (room.phase === 'lobby') {
      for (const position of engine.lobbyLabels()) {
        const label = lobby.querySelector<HTMLElement>(`[data-slot="${position.id}"]`);
        if (label) {
          label.hidden = !position.visible;
          label.style.left = `${position.x}%`;
          label.style.top = `${position.y}%`;
        }
      }
    }
  };
  const refresh = () => {
    const inLobby = room.phase === 'lobby';
    lobby.hidden = !inLobby;
    document.body.classList.toggle('in-lobby', inLobby);
    const practicing = inLobby && room.riding.includes(room.slot);
    document.body.classList.toggle('in-free-ride', practicing);
    el('practice-controls').hidden = !practicing;
    el('online-entry').hidden = room.phase !== 'idle';
    if (inLobby) {
      dialog.close();
      el('menu').hidden = true;
      const wasPracticing = engine.state === 'freeride';
      engine.showLobby(room.practice!, room.members);
      lobby.querySelector<HTMLElement>('.lobby-bottom')!.hidden = practicing;
      document.body.classList.toggle('playing', practicing);
      el('hud').hidden = !practicing;
      if (practicing !== wasPracticing) {
        if (practicing) (document.activeElement as HTMLElement)?.blur();
        else button('enter-practice').focus();
      }
      button('room-pickups').disabled = !room.host;
      button('room-pickups').textContent = room.pickups ? 'PICKUPS ON' : 'PICKUPS OFF';
      button('room-pickups').setAttribute('aria-pressed', String(room.pickups));
      input('room-code').value = room.code;
      button('copy-room').textContent = 'COPY';
      lobby.querySelectorAll<HTMLButtonElement>('[data-room-track]').forEach((card) => {
        const selected = Number(card.dataset.roomTrack) === room.track;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
        card.disabled = !room.host;
      });
      el('room-course-heading').textContent = room.host ? 'SELECT COURSE' : 'HOST’S COURSE';
      el('room-course-number').textContent = `0${room.track + 1} / 03`;
      button('start-room').hidden = !room.host;
      button('start-room').disabled = room.members.length < 2;
      el('room-count').textContent =
        `${room.members.length} ${room.members.length === 1 ? 'RACER' : 'RACERS'}`;
      const member = room.members.find((m) => m.slot === room.slot)!;
      name = member.name;
      if (document.activeElement !== input('profile-name')) input('profile-name').value = name;
      lobby
        .querySelectorAll<HTMLButtonElement>('[data-color]')
        .forEach((b) =>
          b.setAttribute('aria-pressed', String(Number(b.dataset.color) === member.color)),
        );
      el('room-racers').replaceChildren(
        ...room.members.map((member) => {
          const li = document.createElement('li');
          li.style.setProperty('--craft-color', COLORS[member.color]);
          li.textContent = `${member.name}${member.slot === 0 ? ' · HOST' : ''}${member.slot === room.slot ? ' · YOU' : ''}${room.riding.includes(member.slot) ? ' · RIDING' : ''}`;
          return li;
        }),
      );
      el('lobby-labels').replaceChildren(
        ...room.members
          .filter((member) => member.slot !== room.slot)
          .map((member) => {
            const label = document.createElement('span');
            label.dataset.slot = String(member.slot);
            label.style.setProperty('--craft-color', COLORS[member.color]);
            label.textContent = `${member.name}${room.riding.includes(member.slot) ? ' · RIDING' : ''}`;
            return label;
          }),
      );
      positionLabels();
      el('lobby-status').textContent = !room.signalingConnected
        ? 'Reconnecting the room. Joined racers can still race.'
        : room.host
          ? room.members.length < 2
            ? 'Share the code to bring your friends in.'
            : 'Everyone here? Start when you’re ready.'
          : 'Waiting for the host to start.';
    }
    status.textContent = room.phase === 'connecting' ? 'Connecting…' : '';
  };
  room.onChange = refresh;
  room.onRace = (race) => {
    dialog.close();
    hideLobby();
    begin(race);
  };
  room.onEnd = (reason) => {
    hideLobby();
    exit();
    show();
    status.textContent = reason;
  };
  button('host-online').onclick = () => {
    entryAction = 'host-online';
    el('online-title').textContent = 'Creating your room.';
    show();
    void engine.audio.start();
    room.track = TRACKS.indexOf(engine.track);
    void room.open(true, name);
  };
  button('join-online').onclick = () => {
    entryAction = 'join-online';
    el('online-title').textContent = 'Join your friends.';
    input('racer-name').value = name;
    status.textContent = '';
    show();
    input('join-code').focus();
  };
  el<HTMLFormElement>('join-form').onsubmit = (event) => {
    event.preventDefault();
    void engine.audio.start();
    name = input('racer-name').value;
    void room.open(false, name, input('join-code').value);
  };
  input('profile-name').onchange = () => {
    room.setProfile(
      input('profile-name').value,
      room.members.find((m) => m.slot === room.slot)!.color,
    );
  };
  input('profile-name').onkeydown = (event) => {
    if (event.key === 'Enter') input('profile-name').blur();
  };
  lobby.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) => {
    b.onclick = () => room.setProfile(input('profile-name').value, Number(b.dataset.color));
  });
  button('copy-room').onclick = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      button('copy-room').textContent = 'COPIED';
      button('copy-room').blur();
    } catch {
      input('room-code').select();
      el('lobby-status').textContent = 'Select and copy the room code.';
    }
  };
  lobby.querySelectorAll<HTMLButtonElement>('[data-room-track]').forEach((card) => {
    card.onclick = () => room.setTrack(Number(card.dataset.roomTrack));
  });
  button('room-pickups').onclick = () => room.setPickups(!room.pickups);
  button('start-room').onclick = () => room.start();
  button('enter-practice').onclick = () => room.setRiding(true);
  button('leave-practice').onclick = () => room.setRiding(false);
  engine.onLeavePractice = () => room.setRiding(false);
  const leave = () => {
    dialog.close();
    hideLobby();
    exit();
    button(entryAction).focus();
  };
  button('leave-room').onclick = leave;
  button('cancel-online').onclick = leave;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    leave();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && room.host && (room.phase === 'racing' || room.phase === 'loading'))
      room.close('The host tab was hidden. Keep it visible and create a new room.');
  });
  window.addEventListener('pagehide', () => room.close());
  window.addEventListener('resize', positionLabels);
  refresh();
  return {
    room,
    update() {
      positionLabels();
      const online = !!engine.network && !engine.track.practiceRadius;
      document.getElementById('online-race-status')!.hidden = !online;
      document.getElementById('online-results')!.hidden = !online;
      document.getElementById('restart')!.hidden = online;
      document.getElementById('again')!.hidden = online;
      for (const id of ['exit', 'result-exit'])
        document.getElementById(id)!.textContent = online
          ? room.host
            ? 'CLOSE ROOM'
            : 'LEAVE RACE'
          : 'BACK TO COURSES';
      document.getElementById('pause-title')!.textContent = online
        ? 'Race menu.'
        : 'Water can wait.';
      document.getElementById('pause-note')!.textContent = online
        ? room.host
          ? 'The race keeps running. Closing the room ends the race for everyone.'
          : 'The race keeps running while this menu is open.'
        : '';
      if (!online) return;
      const disconnected = room.members.filter((m) => !m.connected).length;
      document.getElementById('online-race-status')!.textContent =
        room.phase === 'loading'
          ? 'WAITING FOR RACERS TO LOAD…'
          : `${room.host ? 'HOST' : `${room.ping} MS`} · ${room.members.length - disconnected} CONNECTED${disconnected ? ` · ${disconnected} DISCONNECTED` : ''}`;
      if (engine.state !== 'finished') return;
      const racers = [...engine.racers].sort((a, b) => {
        const ad = engine.network!.disconnected.has(a.id) && !a.finished,
          bd = engine.network!.disconnected.has(b.id) && !b.finished;
        if (ad !== bd) return ad ? 1 : -1;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        return a.finished
          ? a.finishTime - b.finishTime
          : raceProgress(b, engine.track) - raceProgress(a, engine.track);
      });
      document.getElementById('online-results')!.replaceChildren(
        ...racers.map((r) => {
          const li = document.createElement('li');
          li.textContent = `${r.name} · ${r.finished ? `${r.finishTime.toFixed(3)}s` : engine.network!.disconnected.has(r.id) ? 'DISCONNECTED' : 'RACING'}`;
          return li;
        }),
      );
    },
  };
}
