export const rideHelp = `
<dialog id="help-dialog" aria-labelledby="help-title">
  <h2 id="help-title" tabindex="-1" autofocus>Ride the water.</h2>
  <p class="help-objective">Pass between both glowing buoys, in order. Follow the amber chevrons. The screen-edge guide points you back when a gate is out of view.</p>
  <h3 data-keyboard="KEYBOARD" data-touch="TOUCH CONTROLS" data-gamepad="GAMEPAD">KEYBOARD</h3>
  <dl>
    <dt data-keyboard="W / ↑" data-touch="AUTOMATIC" data-gamepad="RT">W / ↑</dt><dd>Throttle</dd>
    <dt data-keyboard="A D / ← →" data-touch="SLIDE STICK" data-gamepad="LEFT STICK">A D / ← →</dt><dd>Steer and carve</dd>
    <dt data-keyboard="S / SPACE" data-touch="BRAKE" data-gamepad="LT">S / SPACE</dt><dd>Hold while steering to drift; straighten to brake</dd>
    <dt data-keyboard="R" data-touch="RESET" data-gamepad="X">R</dt><dd>Return to your last checkpoint</dd>
  </dl>
  <p data-keyboard="Hold the throttle. Hold Space while steering to drift, then release to grip and accelerate out. Missed a gate? Turn back or reset. Reset runs do not set a local best." data-touch="Throttle is automatic. Slide the stick to steer; hold BRAKE while steering to drift, or straighten to stop. RESET appears when you miss a gate or get stuck." data-gamepad="Hold the right trigger and ease into turns. Hold the left trigger while steering to drift; straighten to brake. X returns you to the last checkpoint.">Hold the throttle and ease into turns.</p>
  <details><summary>Jumps, weight shifts and pickups</summary>
    <dl>
      <dt data-keyboard="SHIFT / C" data-touch="STICK ↓ / ↑" data-gamepad="STICK ↓ / ↑">SHIFT / C</dt><dd>Lean back to lift the bow; forward to stay low and carve tighter</dd>
      <dt data-keyboard="HOLD E" data-touch="HOLD STUNT" data-gamepad="HOLD RB">HOLD E</dt><dd>Enable flips and spins. Hold before takeoff, then release and choose your rotation.</dd>
      <dt data-keyboard="SHIFT / C" data-touch="STICK ↓ / ↑" data-gamepad="STICK ↓ / ↑">SHIFT / C</dt><dd>After release: lean back / forward to flip.</dd>
      <dt data-keyboard="A / D" data-touch="STICK ← / →" data-gamepad="STICK ← / →">A / D</dt><dd>After release: steer left / right to spin.</dd>
      <dt data-keyboard="Q" data-touch="USE" data-gamepad="LB">Q</dt><dd>Use your held pickup</dd>
    </dl>
    <p>Pull back near a wave crest to launch higher. In ordinary flight, leaning back briefly extends airtime at the cost of speed; leaning forward brings you down sooner. Release to settle, and match the next wave's slope for a smooth landing. Too far forward makes a shallow dive; too far back lands stern first and bounces.</p>
    <p>Waves and ramps launch the craft automatically. The stunt button enables rotations; it does not add a jump. During a stunt, hold a direction to keep rotating. Release it near upright to settle; the opposite direction brakes the rotation. Extra airtime allows multiple turns.</p>
    <p>Stunts are optional. Land close to upright: imperfect flips lose speed, and spins keep their landing direction. Inverted or steep, hard landings can throw you off; your rider will swim back and remount.</p>
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
