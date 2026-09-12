# Music in the racing scene

Music gently modulates existing sun glints, breaking foam and the hull wake. The water keeps its base color: there is no broad illumination across wave crests/faces, no rider-centered emitter and no extra displacement. Bass accents remain in the distant illuminated columns. Coastal surf follows the physical waves independently of music.

A continuous mid/treble envelope, smoothed with a 3-per-second exponential response, controls the small surface highlights. A fixed 32-sample live waveform adds variation inside those glints. The wake uses the same smoothing rate and a restrained color range. Rising bass attacks are still detected for the distant lights, with a cooldown and a frame-rate-adjusted slope threshold; sustained notes do not synthesize a tempo.

The shader skips waveform work outside the near field. No extra meshes, draw calls, dependencies or networking messages are added. Reduced motion disables the modulation. Pause, mute and zero music volume clear surface accents; band-driven wake highlights fade smoothly.

## Verification

- 224 unit/simulation tests pass, including envelope behavior at 30/60/120 fps, sustained tones, silence, waveform capture and uniform clearing. Existing coastal CPU/GPU surface and wake-contact tests remain green.
- Production build, formatting and independent code review pass.
- Final native Chromium tests pass for all three actual course songs, mute, pause, reduced motion, coastal rendering/resource cleanup and GPU/CPU shore agreement. Frame time is 16.7–16.8 ms p95 at 1280×800 with six racers.
- All three song integrations and coastal checks passed in phone-sized WebKit during this work. The final softer-lighting pass also passes the Palm soundtrack, mute, pause and reduced-motion checks at 390×844.
- The 20-second renderer capture includes the live soundtrack and game sounds, without the HTML HUD: `artifacts/ride-the-waveform.mp4`.

These are desktop browser measurements. Physical phone performance, speaker balance and separate-network behavior are not claimed.
