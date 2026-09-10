/** The title and race setup share a live ocean scene and retain the selected settings. */
export function setupMenuScreens() {
  const root = document.getElementById('menu')!;
  const home = document.getElementById('menu-home')!;
  const setup = document.getElementById('race-setup')!;
  const enter = document.getElementById('open-setup')!;
  const back = document.getElementById('setup-back')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const show = (screen: 'home' | 'setup', animate = true) => {
    root.dataset.instant = String(!animate || reducedMotion.matches);
    home.classList.toggle('is-active', screen === 'home');
    setup.classList.toggle('is-active', screen === 'setup');
    home.inert = screen !== 'home';
    setup.inert = screen !== 'setup';
    root
      .querySelectorAll<HTMLDetailsElement>('details[open]')
      .forEach((picker) => (picker.open = false));
    const active = screen === 'home' ? home : setup;
    active.scrollTop = 0;
    const target =
      screen === 'home' ? enter : setup.querySelector<HTMLElement>('.course.selected')!;
    target.focus({ preventScroll: true });
  };
  enter.onclick = (event) => show('setup', event.detail > 0);
  back.onclick = (event) => show('home', event.detail > 0);
  return { show };
}
