# Bundled assets and package-license review

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](../FINALIZATION_V014.md). No local tests or audits were rerun.

Review date: 2026-11-10. Metadata is evidence, not clearance of every upstream copyright. No license grant is changed.

## Goal illustrations

Five unchanged non-brand illustrations are covered by the upstream repository license inference, with no separate image grant found. Ownership/rights clearance is still required before publication. SHA identity proves which bytes were copied, not who owns them. See [the compatibility report](../LICENSING_COMPATIBILITY_V014.md).

| Local asset | Pinned upstream path | SHA-256 verified |
|---|---|---|
| `frontend/public/goal-covers/car.png` | `apps/frontend/public/goals/car.png` at `92b4647` | `2954d55eeca2d1a93e2e6e205e78ae12603acb717592ba2af8b5959b3223d4fc` |
| `frontend/public/goal-covers/custom_save_up.png` | `apps/frontend/public/goals/custom_save_up.png` at `92b4647` | `80ca477b8a9049b3d1e97a636ea5a56328af8091be9b7ede6444cc43d71536cf` |
| `frontend/public/goal-covers/education.png` | `apps/frontend/public/goals/education.png` at `92b4647` | `8c0a9ff363536257251df06e37fa3092461845ccc3431ba2e577046eafdbaa69` |
| `frontend/public/goal-covers/home.png` | `apps/frontend/public/goals/home.png` at `92b4647` | `9a7a58f468c1dd892f10ed1d65109a3dcd0a94cd03e19d78228c8ffb0b23121d` |
| `frontend/public/goal-covers/wedding.png` | `apps/frontend/public/goals/wedding.png` at `92b4647` | `38df01b5f4d24fdeb45dbaa964fabd94f7dcb99c136c440edb0f924ab9ac3559` |

## Fonts

Fontsource fonts are self-hosted, with OFL notices preserved in `frontend/public/licenses/`. No CDN is needed. Source filenames, family names and copyright/license text are retained; a project AGPL decision does not replace the font terms.

| Package | Version | Grant evidence |
|---|---|---|
| `@fontsource/dm-sans` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/geist` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/ibm-plex-sans` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/inter` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/jetbrains-mono` | 5.2.8 | OFL-1.1; installed LICENSE |
| `@fontsource/manrope` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/merriweather` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/outfit` | 5.3.0 | OFL-1.1; installed LICENSE |
| `@fontsource/source-sans-3` | 5.3.1 | OFL-1.1; installed LICENSE |
| `@fontsource/source-serif-4` | 5.3.1 | OFL-1.1; installed LICENSE |

The old Public Sans notice remains historical attribution; its presence does not mean that font is currently bundled. Ten installed font families are in the table.

## Package inventory and exceptions

The [machine-readable inventory](DEPENDENCY_LICENSES.json) covers 535 npm lockfile entries (including optional platform packages and dev tools) and 43 installed Python distributions. Non-installed optional package metadata is not represented as an inspected binary license. Each entry records declared terms, notice-file locations and installed/development status.

- MIT/ISC/BSD/Apache software generally permits compatible combinations while retaining its actual copyright/permission/NOTICE requirements. Project copyleft does not erase them.
- Six PayPal-family packages use legacy `licenses` arrays declaring Apache 2.0; the installed full license files were inspected. They are normalized as Apache-2.0 in the inventory rather than incorrectly marked unlicensed.
- Lightning CSS/native platform packages declare MPL-2.0 and are development/build dependencies. Preserve their file/source obligations when conveying them; merely using a compiler does not license all authored output as that compiler. Do not imply that every platform binary was inspected.
- `caniuse-lite` declares CC-BY-4.0 and `mdn-data` CC0-1.0. These build-tool datasets have separate attribution/data terms.
- `victory-vendor` declares MIT AND ISC; its nested vendored d3 license files are inventoried. A root-only LICENSE search would miss these.
- Backend `ofxtools` imports carry GPLv3 considerations. Its exact release copyright/license notice and full GPLv3 text are now preserved in public legal assets. Metadata says GPL-3.0-only while release text permits v3-or-later; neither has been silently rewritten.

MPL obligations should be assessed against the actual distributed files and
[Mozilla's official FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/), including
executable/source notice requirements. No automatic project-wide MPL relicensing
is claimed by listing a build dependency.

## Notice completeness gaps

A package metadata expression alone is not a full copyright/permission notice. These installed runtime packages lack a license file in the published package:

| Package | Version | Declared terms |
|---|---|---|
| `client-only` | 0.0.1 | MIT |
| `embla-carousel` | 8.6.0 | MIT |
| `embla-carousel-react` | 8.6.0 | MIT |
| `embla-carousel-reactive-utils` | 8.6.0 | MIT |
| `pluggy-connect-sdk` | 2.14.2 | MIT |
| `react-pluggy-connect` | 2.12.0 | MIT |
| `react-remove-scroll-bar` | 2.3.8 | MIT |

The three Embla package grants have an existing full `embla-carousel-MIT.txt` notice; verify its scope across the exact artifacts. Other missing published notices require upstream-authorized text/source verification. Do not synthesize copyright holders or years. Several production dependencies do include their own notices in installed packages; artifact-level collection/retention still needs checking before distributing a minified frontend or container. The current public index is a partial notice collection, not a certification that every required runtime notice is shipped.

The Wealthfolio UI package specifically declares MIT, but there is no separate full UI LICENSE in the pinned checkout and no verified UI-specific MIT notice in the current public collection. That remains distinct from ordinary third-party dependency metadata.

## Market observations and preview data

Official BCB CDI and Treasury observations retain source metadata in `backend/app/demo/observations/` and attribution in the root notices. Treasury data uses ODbL-1.0; preserve database attribution/share-alike where applicable. Do not relabel data under the program license. No restricted B3/Brapi ETF histories are bundled; private optional exports and personal data remain excluded. SIM prices/holdings are fictional and are not sourced market data.

## Legal assets and retained evidence

Root and public third-party notices are synchronized factually, including the current v0.14 copying scope. `ofxtools-COPYRIGHT.txt` is copied unchanged from the installed 1.1.1 wheel; `GPL-3.0.txt` comes from the official SPDX license-text mirror after GNU direct access timed out. Existing AGPL/OFL and other notices remain unchanged. This does not grant a license to original Finance Tracker work or establish a version-specific corresponding-source offer.

No logos/trademarks or new product illustrations were imported by this review. Root LICENSE is unchanged.

## Finalization disposition - 2026-11-10

- All five PNGs in the historical table are excluded, not distributed. Neutral
  goal covers preserve the working workflow without unresolved image rights.
- Upstream UI package metadata explicitly declares MIT. Its unchanged package
  metadata and standard MIT permission/warranty text are now served in the legal
  directory. Do not substitute unrelated copyright authors/years for missing data.
- RUNTIME_DEPENDENCY_NOTICES.txt preserves available runtime package copyright/
  license texts, including nested vendor notices. Metadata-only MIT declarations
  are identified honestly; Embla's verified notice remains included. Additional
  genuine upstream notices must be preserved when provided, not invented.
- Root/project/public AGPL text and owner-work metadata now express the approved
  grant. Distinct GPL/OFL/data terms and exact-version source instructions remain.
- These steps resolve the actionable notice/asset gaps for this source-only merge;
  they do not certify unseen contributors' rights or future packaged deployments.
