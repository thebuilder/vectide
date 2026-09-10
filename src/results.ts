import type { Snapshot } from './game/engine';
import { raceProgress } from './game/physics';

export const formatTime = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, '0')}:${(time % 60).toFixed(3).padStart(6, '0')}`;

export function setupResults(list: HTMLOListElement, title: HTMLElement) {
  let signature = '';
  let frame = 0;
  let headline = '';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const settle = () => {
    cancelAnimationFrame(frame);
    if (headline) title.textContent = headline;
  };
  reducedMotion.addEventListener('change', settle);
  return {
    clear() {
      settle();
      headline = '';
      signature = '';
      list.replaceChildren();
    },
    reveal() {
      settle();
      headline = title.textContent ?? '';
      title.setAttribute('aria-label', headline);
      if (reducedMotion.matches) return;
      const started = performance.now();
      const glyphs = '/#<>_';
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / 260);
        title.textContent = [...headline]
          .map((letter, i) =>
            letter === ' ' || i < headline.length * progress
              ? letter
              : glyphs[(i + Math.floor((now - started) / 50)) % glyphs.length],
          )
          .join('');
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    update(s: Snapshot, disconnected: ReadonlySet<number> = new Set()) {
      list.hidden = s.mode !== 'race';
      if (s.state !== 'finished' || list.hidden) return;
      const racers = [...s.racers].sort((a, b) => {
        const ad = disconnected.has(a.id) && !a.finished,
          bd = disconnected.has(b.id) && !b.finished;
        if (ad !== bd) return ad ? 1 : -1;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        return (
          (a.finished
            ? a.finishTime - b.finishTime
            : raceProgress(b, s.track) - raceProgress(a, s.track)) || a.id - b.id
        );
      });
      const next = JSON.stringify(
        racers.map((r) => [r.id, r.name, r.finished, r.finishTime, disconnected.has(r.id)]),
      );
      if (next === signature) return;
      signature = next;
      list.replaceChildren(
        ...racers.map((r, i) => {
          const row = document.createElement('li');
          row.dataset.racer = String(r.id);
          if (r.id === s.player.id) row.setAttribute('aria-current', 'true');
          const position = document.createElement('span');
          position.className = 'result-position';
          position.textContent = String(i + 1).padStart(2, '0');
          const name = document.createElement('span');
          name.className = 'result-name';
          name.textContent = r.name;
          const time = document.createElement('strong');
          time.textContent = r.finished
            ? formatTime(r.finishTime)
            : disconnected.has(r.id)
              ? 'DISCONNECTED'
              : 'RACING';
          time.className = r.finished ? 'result-finished' : 'result-pending';
          row.append(position, name, time);
          return row;
        }),
      );
    },
  };
}
