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

Appearance settings are ordered Language & Region, Appearance Mode, Color Theme,
Charts, Font Family, then Sidebar Order (2026-11-06). The Financial Colors chooser
has been removed. Existing saved gain/loss conventions remain compatible; default
green gains/red losses and semantic warning/error colors are unchanged.

Dashboard, reporting, holdings-filter and settings currency selectors were removed
by user request on 2026-11-06. Screens use their existing default/reporting currency;
explicit currency bookmarks and backend FX/coverage rules remain supported.
Currency labels on amounts and original records are preserved. Account, security,
manual-asset, goal and Life Event forms retain their record currency fields, as
explicitly requested. This is a UI change, not a BRL conversion or data migration.

`lib/preferences.ts` is the validated registry and runtime store. Only font,
palette (theme identity), mode, chartPalette, financialColors, language and sidebarOrder enter
`finance-tracker-preferences-normal` / `finance-tracker-preferences-demo`.
`public/appearance-init.js` validates the same catalog before first paint.
`data-theme` remains light/dark, separate from `data-palette`,
`data-chart-palette` and `data-financial-colors`. System mode responds to OS changes.
Normal/demo preferences remain isolated. Reset appearance preserves language and
financial data; demo financial reset preserves appearance. No backend settings,
financial records, credentials or API contract changes are involved.

Charts offer Theme default (preserves the approved Classic colors), Balanced,
Cool, Warm and Muted. Each independent palette supplies eight decorative series.
Legacy saved gain/loss conventions support standard green/red, reversed red/green
and neutral/blue for compatibility; the chooser is no longer exposed in Settings.
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

Interface language does **not** change financial currency. Financial read-only
numbers use one fixed Brazilian display convention in every language: period
thousands separators, comma decimals, exactly two fractional digits. Examples:
`R$ 57.434,51`, `US$ 1.234,56`, `18,30%`, and `230,00` units. Symbols/codes still
identify the original currency; this is not currency conversion. The shared
`formatMoney`/`formatMoneyParts`, `formatDecimal`, `formatExactPercent` and quantity
helpers consume exact decimal strings through Intl without monetary Number
conversion. Old compact/precision/locale overrides cannot change this convention;
no K/M abbreviations or six-decimal monetary labels remain in normal views.
Dates and counts retain their own semantics. Dates use the selected language's
Intl conventions; native date inputs retain ISO API values and browser/OS widgets.
Chart coordinates remain dimensionless, independent of formatted text.

This is presentation-only rounding. Backend Decimal/storage/API precision, original
currencies, calculations, source evidence and editing precision are unchanged.
Editing controls continue using the selected language's validated decimal input
conventions and retain all original digits. Original imported CSV/OFX/Gmail/provider
text remains source evidence, not relocalized financial display.

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


## Sidebar navigation order

Settings > Appearance & Language > Sidebar order offers keyboard-accessible up/down
buttons for the seven primary navigation destinations, including Settings. Changes
apply immediately to expanded/collapsed desktop navigation and the mobile drawer.
The last slot retains the existing bottom spacing; search, theme and collapse
utilities remain fixed. Routes, active states and page bookmarks do not change.

Order is a validated appearance preference, stored locally with existing normal/demo
isolation. Unknown IDs and duplicates are discarded; missing destinations are
appended in default order. Old preferences without an order retain today's default.
Restore default order resets only navigation; Reset appearance preserves language
and navigation order. Demo financial reset preserves this preference. No financial
records, database schema or network services are involved.


Sidebar-order validation (2026-11-05): 239 frontend tests pass, including malformed
stored order, immutable moves, boundary buttons, live desktop/drawer updates,
normal/demo separation and reset. Isolated Playwright verifies persistence after
reload, mobile routing and restore-default behavior. Lint, formatting and the
TypeScript/production build pass. Local captures: `docs/screenshots/v014-sidebar/`.


Financial display validation (2026-11-05): 240 frontend tests and 22 backend
ledger/ETF financial regressions pass. Browser checks cover eight financial views,
both isolated demo scenarios, three interface languages and mobile layout. Build,
lint and formatting pass. Captures remain local under
`docs/screenshots/v014-numbers/`; financial databases and API values are unchanged.

## Settings migration (unreleased v0.14)

Language now lives first under General. The Appearance editor retains the complete
local theme/font/chart registry and Sidebar order remains its last section. The
removed financial-color chooser stays removed. The existing normal/demo preference
keys and reset behavior are preserved. Theme previews use the shared money formatter.

The November 9 Settings request supersedes the earlier removal of the Settings
reporting-currency control: General now writes the canonical existing reporting
preference. Dashboard/holdings currency selectors remain absent and original record
currencies are never rewritten. Exact formatted monetary values remain 1.234,56.
See [Settings implementation](SETTINGS_V014.md).
