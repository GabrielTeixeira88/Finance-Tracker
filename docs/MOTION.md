# Motion design

The local React UI uses Motion for React, with Recharts animating its own normalized
chart geometry. No backend, financial data or navigation contract changes.

## Tokens and ownership

- `lib/motion.ts`: selection spring 500 stiffness / 35 damping / 0.6 mass;
  layout spring 400 / 30 / 0.8; section fade 160ms; chart update 300ms ease-out.
- `MotionProvider`: one shared configuration and the DOM animation/layout features.
  Components import `m`, keeping feature configuration in one place.
- `SelectionIndicator` / `MotionChoice`: decorative shared-element thumb, scoped
  per control using React IDs. Desktop/mobile navigation have separate scopes.
  The thumb is not focusable and never handles clicks.
- `motion.css`: semantic-token colors and short color/opacity interactions; a
  tiny pressed-state response only on appropriate pointer devices.

These springs and indicator organization adapt the pinned licensed reference's
`packages/ui/src/components/ui/tabs.tsx` and `animated-toggle-group.tsx` at
`d86c20194b4b61ad8133ce820739d5ac83f9045e`. The chart timing follows its history
and performance chart patterns. Attribution stays in THIRD_PARTY_NOTICES.md;
Motion's MIT notice is shipped under frontend/public/licenses.

## Applied patterns

| Area | Behavior |
| --- | --- |
| Sidebar and section navigation | Shared active thumb moves between destinations. Sidebar collapse uses a position-only content transition, without scaling financial text. |
| Spending/investment/analytics ranges | Scoped shared selection where controls remain mounted. Query loading and exact scope remain authoritative; old figures are not kept under new dates for animation. |
| Section changes | A 4px/160ms entrance on the existing main surface; no keyed remount or duplicate exiting financial editors. Filter typing does not replay a page transition. |
| Detail dialogs/inspectors | Short 12px entry after native dialog setup. Close remains immediate; native focus restoration, dirty/pending guards and editor identity are retained. |
| Charts | Recharts interpolates normalized coordinates over 300ms. Spending's bounded daily bars update their percentage geometry. Exact values, tooltips, tables and missing-data gaps never interpolate. |
| Buttons | Restrained color feedback and a small pressed response. No row-by-row stagger, counting money, continuous motion or decorative looping. |

## Accessibility and performance

A shared `useSyncExternalStore` subscription responds to OS reduced-motion changes
while the application remains mounted. The provider updates Motion's policy;
local layout/entrance effects and Recharts interpolation are disabled as well.
CSS transitions are disabled and scrolling becomes immediate. Preference changes
must not remount a form or clear an unsaved draft. Unknown server/browser support
uses a static fallback. Animation completion never controls financial actions.

Use transform/opacity and position-only layout projection where appropriate.
Do not apply global layout animation to transaction tables or whole chart grids;
large histories must not create thousands of animated nodes. Do not convert money
to Number for animation. Existing dimensionless BigInt-ratio coordinates remain
the only numeric chart inputs. Native dialogs retain their top-layer/focus semantics.

## Validation

`npm test`, `npm run lint`, `npm run format:check`, `npm run build` from frontend.
The motion unit coverage tests initial/live reduced motion, unsupported media
queries, independent decorative indicators and keyboard activation. The existing
financial/editor regression suite remains in place.

Browser validation: from the repository root, set `DEMO_E2E_PORT=5174` in the host
shell, then `node frontend/scripts/ux-shell-e2e.mjs --motion`. This runner creates
its own synthetic workspace and exercises the existing desktop/mobile workflows,
plus actual intermediate shared-element positions, live reduced motion, immediate
static selection and draft preservation. Sampled frames are saved locally to
`.tmp/motion-evidence.json`. It never touches the normal or saved demo database.

Validated 2026-10-29: 188 frontend tests across 33 files; ESLint, Prettier,
TypeScript and production build passed. The isolated browser run passed both the
existing screen/workflow checks and the motion-specific checks; 86 sampled
frames included intermediate spring positions, reduced selection had no transform,
and the edited draft survived both preference changes. Backend/schema/posting
code was not changed by this task; backend tests were not rerun for this UI-only
change. Existing build annotation/large-chunk advisories remain.

The production dependency audit reports an existing high-severity Zod advisory
affecting locked 4.6.5, also present before this task. Motion dependencies have no
reported advisory in that audit. No unrelated dependency upgrade was applied.
