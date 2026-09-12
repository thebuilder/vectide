# Lower islands and coastal surf

Target: the approved cover's low, irregular faceted islands and slender palms with detailed crowns. Replace tall slab banks and separate cone hills, preserve navigable course outlines, and make shallow coastal water meet the beaches rather than passing over land.

1. Add one shared shoreline field for CPU water sampling and GPU displacement. Offshore waves stay unchanged; coastal swell tapers and breaks toward the bank. Verify GPU/CPU agreement, inland coverage and existing race simulations.
2. Lower tropical islands, create layered beach/ground facets, anchor trees/buildings to the actual terrain, and refine palm trunks/crowns. Preserve collision/course footprints and authored landmarks.
3. Render surf along the actual shore, inspect close and chase-camera views, run full course races and phone-sized WebKit checks, measure frame pacing, and review the final diff. Deliver a new local preview/capture.

No deployment or PR publication is part of this request.

## Completed verification

- 222 unit/simulation tests pass. Bank samples remain below the dry shoreline over changing swell, items retain coastal physics, open-water practice removes the coast, and palms/buildings have mesh support.
- CPU/GPU coastal heights agree within 0.002 units at shoreline, surf and offshore samples across four times, including WebKit.
- Native Chromium full laps pass on Palm, Harbor and Storm; the authored Palm launch remains intact. One initial Palm run was invalidated by a live module update (the failure snapshot was back at the title); its unchanged-source rerun passed. An initial Harbor weapons-race lap exceeded its 75-second bound, while its rerun passed.
- All three course performance checks pass at 1280×800, six racers, native Metal: p95 16.7–16.8 ms. Phone-sized WebKit coastal rendering/resource cleanup and height tests pass.
- Two rendered local WebRTC racers drive with the changed water; all three old/new host/guest mismatch checks pass. Physics compatibility VERSION is 14 and the existing discovery prefix stays unchanged.
- Production build, formatting and independent code review pass. A 12-second renderer close-up shows the moving surf in `artifacts/coastal-surf.mp4`.

Physical phone performance and separate-network multiplayer were not measured. No deployment or PR was published.
