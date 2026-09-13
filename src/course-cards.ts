import { TRACKS } from './game/tracks';

export function courseCards(attribute: 'data-track' | 'data-room-track') {
  return TRACKS.map((t, i) => {
    const route = `M${t.points
      .filter((_, index) => index % 8 === 0)
      .map((point) => `${point.x},${point.z}`)
      .join('L')}Z`;
    return `<button class="course ${i === 0 ? 'selected' : ''}" ${attribute}="${i}" style="--course-accent:${t.accent}" aria-pressed="${i === 0}"><span class="course-index">0${i + 1}</span><span class="course-status" aria-hidden="true">SELECTED</span><span class="course-name">${t.name}<small>${t.sea} WATER</small></span><svg class="course-line" viewBox="${Math.min(...t.points.map((p) => p.x)) - 20} ${Math.min(...t.points.map((p) => p.z)) - 20} ${Math.max(...t.points.map((p) => p.x)) - Math.min(...t.points.map((p) => p.x)) + 40} ${Math.max(...t.points.map((p) => p.z)) - Math.min(...t.points.map((p) => p.z)) + 40}" aria-hidden="true"><path d="${route}"/><path class="course-tracer" d="${route}" pathLength="1"/></svg></button>`;
  }).join('');
}
