# Appearance and localization (Unreleased)

Settings → Appearance & Language provides six full themes (Classic, Midnight
Cobalt, Carbon Amber, Amethyst Night, Porcelain Blue and Sandstone Copper), each
in light and dark mode. Classic / JetBrains Mono / dark remains the unchanged
default. The nine other previous palettes remain in **Previous color palettes**;
existing saved choices are preserved.

Ten self-hosted font choices: JetBrains Mono, Inter, Geist, Manrope, IBM Plex Sans,
DM Sans, Source Sans 3, Outfit, Merriweather and Serif / Source Serif 4. Each has
real 400/500/600/700 faces. DM Sans lacks tabular digits in its bundled face, so
financial values use bundled Inter while surrounding text keeps DM Sans. No CDN
is contacted. Public Sans falls back to Inter; old Slate/Sand/Orange choices fall
back to Graphite. The newly requested fonts restore Manrope/Plex/DM keys.

## Independent preferences

`lib/preferences.ts` is the validated registry and runtime store. Only font,
palette (theme identity), mode, chartPalette, financialColors and language enter
`finance-tracker-preferences-normal` / `finance-tracker-preferences-demo`.
`public/appearance-init.js` validates the same catalog before first paint.
`data-theme` remains light/dark, separate from `data-palette`,
`data-chart-palette` and `data-financial-colors`. System mode responds to OS changes.
Normal/demo preferences remain isolated. Reset appearance preserves language and
financial data; demo financial reset preserves appearance. No backend settings,
financial records, credentials or API contract changes are involved.

Charts offer Theme default (preserves the approved Classic colors), Balanced,
Cool, Warm and Muted. Each independent palette supplies eight decorative series.
Gain/loss conventions offer standard green/red, reversed red/green and neutral/blue.
They affect financial signs, never error/destructive/success UI states. Goal health
is also independent: an off-track badge remains an explicit warning. Exact values,
signs, labels, chart coordinates and financial calculations are unchanged.

## Semantic token architecture

`appearance.css` retains Classic and legacy palettes and font imports.
`themes/tokens.css` adds complete light/dark themes and shared semantic aliases;
`themes/charts.css` owns independent decorative palettes. They load after the
existing layout CSS. `index.css` maps semantic colors into Tailwind. Existing
`--chart-line` / `--chart-secondary` are compatibility roles for series 1/2; do not
introduce per-page color arrays. Charts use exact labels and dimensionless geometry.

Surface/interaction roles include background, foreground, card, popover, sidebar,
muted, border, input, ring, primary, secondary and accent, with foreground pairs.
Financial positive/negative are separate from success/destructive/warning/info.
Charts expose eight series, grid/axis/tooltip/cursor plus investment/spending/
net-worth/income roles. Goals expose a progress role and retain health-specific
success/destructive colors. Overlay shadows/backdrops remain neutral alpha values.
Portals resolve the same root tokens. Preview miniatures use the actual theme CSS
selectors (including Classic) with illustrative balance/chart geometry only; they
never query or pretend to show a real portfolio.

To add a theme: add its stable identity/name in `preferences.ts`, complete light
and dark selectors in `themes/tokens.css`, and the prepaint allowlist. Preserve old
keys; do not change a saved font/chart preference. Add a chart palette only in the
central registry, bootstrap and `themes/charts.css`. Run unit, build and browser
validation. No generator or runtime theming dependency is required.

The reference architecture was inspected in cached official source d86c201:
`apps/frontend/src/themes/definitions/classic.css`, generated themes and
`scripts/theme-generate.mjs`, `components/theme-selector.tsx` and the settings
appearance form. Useful concepts are semantic completeness, base
fallbacks and mode-independent theme identity. Finance Tracker keeps its existing
mode attribute and simpler handwritten CSS; no new third-party source was copied.
Existing attribution and licenses remain intact.

## Validation and review

`npm run test`, `npm run lint`, `npm run format:check`, `npm run build`.
`DEMO_E2E_PORT=5174 node scripts/demo-e2e.mjs --real-market-only --themes`
creates its own isolated Brazil demo workspace, never the personal database.
The browser checks all six themes in both modes, token completeness, text contrast
on background/card, persistence, OS changes, gain/loss isolation, eight routes,
mobile overflow and unchanged account responses. The existing `--typography`
workflow checks real font faces, tabular financial digits and application workflows.
See [theme screenshots](screenshots/themes/index.html).

The frontend suite passes 213 tests; lint, formatting and TypeScript/production
build pass. New themes exceed AA normal-text contrast on tested surfaces (minimum >5:1).
Classic retains the approved original palette: its dark muted text on card is
approximately 4.26:1, below 4.5:1. This preexisting exception is recorded rather
than silently altering the requested unchanged default. Chart colors are decorative
and never substitute for financial signs or labels. Existing large-bundle and npm
dependency-audit warnings remain separate work; no automatic dependency upgrade
or financial data change was made.

## Translation contracts

`lib/i18n.ts` initializes i18next/react-i18next with bundled, page-oriented
namespaces in `locales/en.json`, `pt-BR.json`, and `es-419.json`. English is the
fallback. Keys identify application copy; interpolation values preserve original
user text. `ui()` is restricted to application-owned constant and enum labels.
Never pass account/payee/category/security names, notes, source descriptions, or
arbitrary backend error prose through that helper. Keep route IDs, enum values,
option values and API payloads independent of translated labels.

Interface language does **not** change financial currency. Currency values use
the existing exact-string Intl formatter. `es-419` uses the platform's CLDR Latin
American conventions, including period decimals and comma grouping; it does not
select MXN or another currency. pt-BR uses comma decimals and period grouping.
Dates use Intl; native date inputs retain ISO API values and browser/OS widgets.
Percentages retain exact decimal labels. Counts and bounded dimensionless chart
coordinates may use Number; monetary values must never do so.

`DecimalInput` separates visible localized text from canonical exact strings.
`parseLocalizedDecimal` validates grouping/sign/fraction without float conversion;
`exactFormData` reads canonical values from these inputs. Invalid/incomplete input
fails native validity and domain validation. Controlled inputs, pasted grouped
values, negative values, six decimal places and form resets are covered by tests.
CSV/OFX source parsing still uses explicit source-format settings; changing UI
language never reinterprets stored source records.

## Errors and remaining boundaries

The API adds language-neutral `X-Error-Code` headers to HTTP/validation exceptions,
without changing existing response bodies. The client translates transport and
validation codes; English retains existing safe domain diagnostics. Original
diagnostics remain on `ApiError.diagnostic` for debugging, without automatic logs.
No translation relies on parsing English exception text. Fine-grained domain-error
codes remain future work: non-English users currently get a localized safe
operation/validation/conflict message for legacy prose errors. Some server-provided
methodology/evidence text remains original English; it is not inferred or rewritten.
Native browser validation/dialog chrome follows browser/OS language. Zod uses its
Brazilian Portuguese and Spanish locale plus application-specific exact-money copy.

Tests check catalog parity/interpolation, locale formatting, input precision,
preference isolation and API error-code stability. The existing isolated demo
browser runner adds font/palette/language switching, exact Portuguese expense
posting, persistence and reset checks:

```sh
cd frontend
npm run build
npm run test:demo -- --appearance
```

The runner creates its own synthetic workspace. Never aim it at an existing local
database or running user server. Screenshots go to `docs/screenshots/v013/after`.
