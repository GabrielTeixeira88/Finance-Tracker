# v0.14 licensing and dependency review summary

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](FINALIZATION_V014.md). No local tests or audits were rerun.

Review date: 2026-11-10. Branch: `feature/v0.14.0-frontend-refinement`.
No license grant, financial logic, version, commit or remote setting changed.

## Decision

**NOT READY FOR RELEASE REVIEW.** The licensing investigation is complete enough
to recommend a concrete path, but adopting that path requires explicit owner
approval, rights/notice clearance and corresponding-source preparation. The
development advisory remains open with qualified, documented workflow exposure.

Recommend **Option A: AGPL-3.0-only for the owner-authored project**, preserving
third-party MIT/ISC/Apache/OFL/GPL and data-license terms. This is a practical fit
for a public, self-hosted portfolio project. It is a technical recommendation,
not a qualified legal opinion or permission to license other people's work.

## Licensing findings

- The substantially integrated AGPL-derived frontend needs a compatible whole-work
  grant for distribution. SPDX headers and an All Rights Reserved exception do
  not themselves provide that grant for the original integrated work.
- HTTP/API separation alone does not prove the Python backend must be AGPL.
  **However, the backend directly imports GPL-covered ofxtools**, so even an
  independently authored backend cannot simply be described as a permissively
  licensed combined application without reviewing that dependency relationship.
- Public GitHub main already contains the restrictive root notice and an
  AGPL-adapted app shell. Existing distribution needs review, not merely a future
  v0.14 release. No infringement determination or retroactive cure is asserted.
- The UI package declares MIT, while its complete UI-specific permission/copyright
  notice is not verified. Five goal illustrations rely on the repository-license
  inference, not separate image-ownership clearance. Artifact notice completeness
  and exact corresponding-source/legal UI access also remain unresolved.

The [compatibility report](LICENSING_COMPATIBILITY_V014.md) evaluates Options A-D,
frontend/backend scope, source/build/network distribution and counsel questions.
The [source inventory](licensing/SOURCE_FILE_INVENTORY.md) and
[JSON evidence](licensing/SOURCE_FILE_INVENTORY.json) identify individual files,
headers, hashes, source paths and original-code candidates. An absent header is
not proof of original authorship. [Lineage follow-up](licensing/LINEAGE_FOLLOWUP.md)
distinguishes unresolved exact mappings from intentionally inspected-only source.

The [package inventory](licensing/DEPENDENCY_LICENSES.json) covers npm lock entries
and the project Python environment. [Bundled assets](licensing/BUNDLED_ASSETS.md)
records fonts, illustrations, market-data terms and missing notice evidence.

## Safe corrections completed

1. Corrected the obsolete blanket statement that no complete components or
   illustrations were copied; preserved historical pass descriptions and attribution.
2. Synchronized current root/public third-party notices. Existing component/font
   licenses remain, and no upstream author or grant is removed.
3. Preserved the exact ofxtools 1.1.1 release notice and full standard GPLv3 text;
   added explicit dependency links in the existing public legal index. Metadata's
   GPL-3.0-only and the release text's v3-or-later wording are both recorded.
4. Produced file/package/asset/advisory inventories and a concrete approval checklist.

These notices do not select a project license, prove image ownership or constitute
a build-specific corresponding-source offer. Root `LICENSE` is unchanged; its
SHA-256 is `1f2db0ad893aa0e56a7a912a80159a02c561fa5ab4bafa4cfa0c37d32feb911a`.

## Approval needed before implementation/publication

- Select A (recommended), B (scoped grants with legal boundary review), C (replace
  affected derivation and address backend GPL), or D (written rights-holder permission).
- Confirm authority to grant the chosen terms for original contributions, including
  other contributors/employer interests; choose the correct copyright holder(s).
- Approve replacing the root grant and corresponding original-work/package metadata.
  Preserve all third-party terms rather than relabeling them as owner-authored code.
- Approve legal UI notices, exact source archive/revision/access method and packaging
  changes after the corresponding artifact exists. Do not promise unavailable source.
- Resolve UI notice/image/lineage clearance and have counsel assess combined-work
  boundaries, existing public distribution and any corrective steps.
- Authorize any Git/publishing action separately. This task grants no such authority.

## Dependency result

The ten remaining moderate entries trace to **one** underlying minimatch advisory,
GHSA-g3hv-75wg-m249 / CVE-2026-118764. Installed minimatch is 10.2.6; the first
patched version is 11.0.1. Even the queried latest ESLint/config-array/typescript-estree
parents retain 10.x ranges. No compatible fix was available for this finding.

**New dependency patches applied: none.** Existing Vitest 4.1.12 remains patched;
the lockfile is unchanged. No major override, forced downgrade or disabled audit
was used. Ten entries remain development-only; production audit is clear.

Inspected callers use default optimization level 1 and repository-owned globs;
the advisory requires attacker-controlled globs with level 2 or above. No current
exploitable path was demonstrated. This conditional analysis is not a blanket
safety guarantee or silent risk acceptance. Resolve through supported parent
updates or explicitly review/accept the documented development-only risk.

See [the full advisory matrix](DEPENDENCY_SECURITY_V014.md) for versions, dependency
chains, affected ranges, breakage implications and CI/workflow safeguards.

## Validation executed

| Check | Result |
|---|---|
| `npm.cmd test` | 330 passed, 76 files, Vitest 4.1.12 |
| `npm.cmd run lint` | Passed |
| `npm.cmd run format:check` | Passed, including public notice updates |
| `npm.cmd run build` | TypeScript and Vite passed; known chunk/annotation warnings remain |
| `npm.cmd audit --omit=dev --json` | 0 vulnerabilities |
| `npm.cmd audit --json` | 10 moderate development-only package entries, 1 underlying advisory; 0 high/critical |
| `npm.cmd ls --omit=dev minimatch --json` | No production chain |
| Upstream original hashes | All 233 match pinned checkout |
| Public legal links/assets | All 34 index links resolve locally; packaged copies match public files |
| ofxtools release notice | Unchanged exact installed-release notice |
| Root license / lockfile | Unchanged |
| Financial/backend/browser workflows | Not rerun in this review; no application logic changed. Prior application audit remains separate evidence |

No personal/demo database, credential or live integration was accessed. No merge,
push, tag, release or license change was performed. The working tree retains all
previous v0.14 changes for review.
