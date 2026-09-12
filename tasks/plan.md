# Showcase polish

The user approved the generated cover, asked to use it as the OG image and visual target, and approved the prior polish proposal. Checkpoint visibility on mobile is the first gameplay priority. Work starts from origin/main f960c15.

## Build order and acceptance

1. **Cover**: publish the approved image at the existing OG asset path, correct metadata dimensions and description, and retire the previous procedural cover generator.
2. **Navigation**: replace the subtle static gate triangle with a clear animated marker; indicate off-screen and behind-camera gates inside a safe viewport region on portrait and landscape screens. Preserve actual gate admission, course geometry, recovery, and multiplayer rules. Respect reduced motion. Passing a gate receives concise feedback.
3. **First race and menus**: show current-device basics in context, make controls available from pause, open help at its beginning, explain difficulty, strengthen text backing, and keep Start Race discoverable on short screens. Keep existing modes; an extra Quick Race mode is optional and not needed if the first-race flow is clear.
4. **Water contact and visual target**: move the water palette, highlights, coherent wake, spray and rider separation toward the approved artwork while retaining the procedural faceted style and existing physics. Camera motion is restrained and respects reduced motion.
5. **Finish**: retain existing splits, local bests and autopilot; add a brief finish camera beat, sound and clear performance result, with immediate replay.
6. **Delivery checks**: verify complete solo races on all courses, representative mobile/touch layouts, keyboard/controller paths, finish and recovery, reduced motion, sound, performance and available multiplayer scenarios. Provide a quality fallback if measurements justify it. Document physical-device and separate-network checks that this environment cannot perform.

## Implementation and validation

Source is TypeScript with explicit small modules and native HTML overlays. Preserve current coding style and use Prettier. Tests live in `tests/` (Vitest) and `e2e/` (Playwright). New tests should exercise projection boundaries, state transitions and actual user behavior, not mirror styling declarations.

- Development: `pnpm dev --port 5188`
- Types and simulation: `pnpm check`
- Production: `pnpm build`
- Formatting: `pnpm format:check`
- Browser: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5188 pnpm test:browser`
- Multiplayer: inspect its dedicated config before `pnpm test:multiplayer`.

Implement and verify each increment before moving on. No new runtime dependencies, physics shortcuts or production deployment are needed. Update README with player-facing changes and keep evidence in ignored `artifacts/`.
