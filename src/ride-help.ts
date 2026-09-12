export const rideHelp = `
<dialog id="help-dialog" aria-labelledby="help-title">
  <h2 id="help-title" tabindex="-1" autofocus>Ride the water.</h2>
  <p class="help-objective">Pass between both glowing buoys, in order. Follow the amber chevrons. The screen-edge guide points you back when a gate is out of view.</p>
  <h3 data-keyboard="KEYBOARD" data-touch="TOUCH CONTROLS" data-gamepad="GAMEPAD">KEYBOARD</h3>
  <dl>
    <dt data-keyboard="W / ↑" data-touch="AUTOMATIC" data-gamepad="RT">W / ↑</dt><dd>Throttle</dd>
    <dt data-keyboard="A D / ← →" data-touch="SLIDE STICK" data-gamepad="LEFT STICK">A D / ← →</dt><dd>Steer and carve</dd>
    <dt data-keyboard="S / SPACE" data-touch="BRAKE" data-gamepad="LT">S / SPACE</dt><dd>Slow down before a tight turn</dd>
    <dt data-keyboard="R" data-touch="RESET" data-gamepad="X">R</dt><dd>Return to your last checkpoint</dd>
  </dl>
  <p data-keyboard="Hold the throttle and ease into turns. Missed a gate? Turn back or reset. Reset runs do not set a local best." data-touch="Throttle is automatic. Slide the stick to steer; hold BRAKE to slow down. RESET appears when you miss a gate or get stuck." data-gamepad="Hold the right trigger and ease into turns. Use the left trigger to brake. X returns you to the last checkpoint.">Hold the throttle and ease into turns.</p>
  <details><summary>Jumps, weight shifts and pickups</summary>
    <dl>
      <dt data-keyboard="SHIFT / C" data-touch="STICK ↓ / ↑" data-gamepad="STICK ↓ / ↑">SHIFT / C</dt><dd>Shift weight back / forward</dd>
      <dt data-keyboard="HOLD E" data-touch="HOLD JUMP" data-gamepad="HOLD RB">HOLD E</dt><dd>Prepare a flip. Release at takeoff.</dd>
      <dt data-keyboard="STEER + E" data-touch="JUMP" data-gamepad="STICK + RB">STEER + E</dt><dd data-keyboard="Steer while loading to prepare a spin." data-touch="Use a wave crest or amber ramp to launch your flip." data-gamepad="Steer while loading to prepare a spin.">Steer while loading to prepare a spin.</dd>
      <dt data-keyboard="Q" data-touch="USE" data-gamepad="LB">Q</dt><dd>Use your held pickup</dd>
    </dl>
    <p>Jumps are optional. Land close to upright: imperfect flips lose speed, and spins keep their landing direction. Inverted or steep, hard landings can throw you off; your rider will swim back and remount.</p>
  </details>
  <button id="close-help" class="primary">GOT IT</button>
</dialog>`;

export function setupRideHelp() {
  const dialog = document.getElementById('help-dialog') as HTMLDialogElement;
  const heading = document.getElementById('help-title')!;
  let origin: HTMLElement | undefined;
  for (const id of ['help', 'pause-help']) {
    const button = document.getElementById(id)!;
    button.onclick = () => {
      origin = button;
      dialog.querySelector('details')!.open = false;
      dialog.showModal();
      dialog.scrollTop = 0;
      heading.focus({ preventScroll: true });
    };
  }
  document.getElementById('close-help')!.onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (origin?.getClientRects().length && !origin.closest('[hidden],[inert]'))
      origin.focus({ preventScroll: true });
  });
}
