/** The title and race setup share a live ocean scene and retain the selected settings. */
export function setupMenuScreens() {
  const root = document.getElementById('menu')!;
  const home = document.getElementById('menu-home')!;
  const setup = document.getElementById('race-setup')!;
  const enter = document.getElementById('open-setup')!;
  const back = document.getElementById('setup-back')!;
  const mobileHeader = matchMedia('(max-width: 700px), (max-height: 500px) and (pointer: coarse)');
  const placeBack = () => {
    if (mobileHeader.matches) document.querySelector('.masthead')!.prepend(back);
    else setup.querySelector('.setup-heading')!.prepend(back);
  };
  mobileHeader.addEventListener('change', placeBack);
  placeBack();
  back.hidden = true;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const show = (screen: 'home' | 'setup', animate = true) => {
    back.hidden = screen !== 'setup';
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
    const setupScroll = active.querySelector<HTMLElement>('.setup-scroll');
    if (setupScroll) setupScroll.scrollTop = 0;
    const target =
      screen === 'home' ? enter : setup.querySelector<HTMLElement>('.course.selected')!;
    target.focus({ preventScroll: true });
  };
  enter.onclick = (event) => show('setup', event.detail > 0);
  back.onclick = (event) => show('home', event.detail > 0);
  return { show };
}
