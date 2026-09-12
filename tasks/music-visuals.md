# Music in the racing water

The soundtrack should be visible in the ocean being ridden. Bass transients now light the existing wave crests, the midrange colors their faces, and treble catches breaking foam and the hull wake. A short live waveform sample adds detail along the crests. All light follows the authored water surface; there is no rider-centered emitter, extra displacement, camera motion or gameplay timing change.

The existing audio analyser provides frequency energy and time-domain samples. Rising bass attacks are detected with a cooldown and a frame-rate-adjusted slope threshold. Sustained notes and silence do not synthesize a tempo. The shader uses one fixed 32-float buffer and skips waveform work outside the near field. No extra meshes, draw calls, dependencies or networking messages are added.

Reduced motion disables the added modulation. Pause, mute and zero music volume clear beat accents; existing band highlights fade smoothly with the analyser. The effect resumes from live audio rather than replaying stored pulses.

## Verification

- 217 unit/simulation tests pass, including bass attacks at 30/60/120 fps, sustained notes, silence, waveform capture and uniform clearing. Existing CPU/GPU surface and wake contact tests remain green.
- Production build and formatting pass.
- Native Chromium, all three real course songs: roughly 16.7–16.8 ms p95 frame time at 1280×800 with six racers. The soundtrack-specific tests observe real beat changes, waveform values and wake response.
- Phone-sized WebKit: all three songs pass live waveform, wake response, pause, mute and reduced-motion checks at 390×844.
- All seven final Chromium checks pass: three course music integrations, soundtrack selection/mute, GPU/CPU water agreement, weapon lighting and wake release.
- A 20-second in-game capture includes the live soundtrack and game sound mix. It records the renderer without the HTML HUD.

These are desktop browser measurements. Physical phone performance, speaker balance and controller feel are not claimed.
