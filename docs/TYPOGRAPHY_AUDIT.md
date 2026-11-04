# Typography and appearance audit — 2026-10-31

Current catalog update (2026-11-04): the complete appearance request supersedes
this historical audit. Ten fonts now include Geist and restore Manrope, IBM Plex
Sans and DM Sans; Public Sans remains retired. Six complete themes coexist with
nine legacy palettes. Chart palettes and gain/loss conventions are independent.
DM Sans financial values use Inter for true tabular digits. See
[current preferences](APPEARANCE_AND_LOCALIZATION.md) and the
[theme review gallery](screenshots/themes/index.html).

Scope: appearance choices and shared typography; no financial or navigation changes.
Existing font, palette, language and workspace preferences remain valid. Reset
appearance keeps its existing defaults; no saved selection is silently replaced.

## New options

| Font         | Intended character                              |
| ------------ | ----------------------------------------------- |
| Manrope      | Geometric, restrained sans serif                |
| Public Sans  | Neutral, practical sans serif for dense screens |
| Outfit       | Softer geometric sans serif                     |
| Merriweather | Editorial serif alternative                     |

Existing choices remain JetBrains Mono, Inter, IBM Plex Sans, Source Sans 3 and
DM Sans. All nine use real, locally bundled 400/500/600/700 faces with OFL notices.
No remote font loading or financial data changes accompany a font switch.

| Palette | Surfaces / accent            |
| ------- | ---------------------------- |
| Ocean   | Cool blue-gray / cyan-blue   |
| Indigo  | Neutral violet-gray / indigo |
| Sand    | Warm stone / amber           |
| Rose    | Muted rose-gray / cranberry  |

Each has light and dark variants. Existing Olive, Slate, Graphite, Forest and Plum
remain. Positive/negative/warning semantics stay independent of the chosen accent.
Pre-paint initialization and runtime use the same validated options; normal and
demo preferences remain separate.

## Findings and corrections

- 38 explicit CSS text declarations used 8–10px. Raise them to the 11px minimum,
  without resizing icons or chart geometry. Chart tick labels also use at least 11px.
- Standardize the shared scale: 11px auxiliary labels, 12px metadata, 14px body,
  16px supporting copy, 18px phone / 20px desktop page headings and up to 30px
  primary values. Preserve page-specific hierarchy within that scale.
- Shared page headings use 600 weight; section headings and controls use 500;
  important totals can use real 600/700. Editorial goal titles remain regular 400.
- Optional sans families previously loaded only 400/500/600, although bold styles
  requested 700. Load actual 700 faces instead of relying on nearest-weight fallback.
- A global `font: inherit` rule overrode layered button weight/size utilities.
  Restrict that reset to font family so the shared controls retain their variants.
- Browser digit measurements found proportional figures in the bundled DM Sans
  face. Use Inter for DM Sans financial figures; retain DM Sans for interface text.
  Other choices retain their own tabular figures. Exact-string money is unchanged.
- Replace hardcoded Georgia in goal display roles with licensed Merriweather in
  default monospaced mode; alternative font choices apply to goal headings too.

## Source basis

Inspected the pinned reference `d86c201`: `apps/frontend/src/globals.css`,
`themes/definitions/classic.css`, `components/font-selector.tsx`,
`packages/ui/src/components/ui/page.tsx`, and the spending hero / goal card source.
The reference specifies an 11px minimum, 18/20px page titles, real font weights and
30px primary financial values. Existing adapted-source notices remain applicable.
Additional palettes are authored local alternatives, not copied branding/themes.

Font package references: [Manrope](https://fontsource.org/fonts/manrope),
[Public Sans](https://fontsource.org/fonts/public-sans),
[Outfit](https://fontsource.org/fonts/outfit),
[Merriweather](https://fontsource.org/fonts/merriweather).

## Validation

Use `node scripts/demo-e2e.mjs --typography` from `frontend` with a free approved
port (for example `DEMO_E2E_PORT=5174`). The runner owns a fresh isolated synthetic
workspace; never attach it to a saved database or user's server.

The audit checks all palettes in both modes, 4.5:1 text/semantic-color contrast,
actual loaded 700 font faces, equal-width financial digits, preference persistence,
shared button/title weights and minimum rendered text sizes on the main screens.
It captures a dark Public Sans/Ocean example and light Manrope/Sand example,
including phone layout. Results and screenshots live in
`docs/screenshots/appearance-options/`. Backend code and financial calculations
are unchanged; the existing demo browser workflows exercise the API as regression checks.

Final results: 200 frontend tests passed, as did ESLint, formatting, TypeScript and
the production build. The isolated browser matrix passed all 18 palette/mode
contrast checks, nine real bold-face and effective tabular-digit checks, layout
with each family on Goals/Transactions, and the main-screen typography audit.
Goal health uses positive/negative tokens independently of accent hue, including
Rose and Sand. [Screenshots and measured results](screenshots/appearance-options/index.html).

The existing large-chunk build warning remains. The dependency audit reports
14 moderate and one high advisory in existing tooling/Zod; the four added OFL font
packages have no dependencies and no advisories. Dependency remediation outside
the requested font packages was not performed as part of this appearance change.
