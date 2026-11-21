# v0.14 licensing compatibility review

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](FINALIZATION_V014.md). No local tests or audits were rerun.

Review date: 2026-11-10. This is a technical licensing investigation and proposed
compliance plan, not a legal opinion, a new license grant or a certification.
No root license, original-work licensing, publication or financial behavior is
changed by this report. A qualified lawyer should resolve the boundaries and
rights questions identified below before a distribution decision.

## Recommendation and current blocker

**Recommend Option A:** after explicit owner approval and confirmation of the
necessary contributor rights, license the owner-authored Finance Tracker project
under **AGPL-3.0-only**, retaining separate MIT/ISC/Apache/OFL and other upstream
terms for third-party material. This is the simplest fit for a public portfolio
and self-hosted open-source application with substantial integrated AGPL frontend
adaptations. It avoids depending on a disputed frontend/backend separation to
justify a restrictive license. It does not mean claiming ownership of upstream
code or replacing third-party licenses. The backend also imports the GPLv3
`ofxtools` library in process, so its distribution analysis is not simply a choice
between an AGPL frontend and an otherwise permissive dependency stack.

**Publication remains blocked.** Root `LICENSE` still withholds general permission
for original project code. AGPL headers on adapted files do not settle the grant
for the integrated original parts. Root's disclaimer that third-party terms survive
is useful, but does not supply that missing whole-work permission. Sections 4-6
of the actual [upstream license](https://github.com/wealthfolio/wealthfolio/blob/92b4647f74ec51fbbb1a772db4f42ea91060c518/LICENSE)
govern conveyance; section 5(c) addresses the whole modified work. The same complete
license is bundled at `frontend/public/licenses/Wealthfolio-AGPL-3.0.txt`.

This is not solely a hypothetical v0.14 release concern. Read-only GitHub checks
on this review date confirmed that public
[main LICENSE](https://github.com/GabrielTeixeira88/Finance-Tracker/blob/main/LICENSE)
contains the restrictive notice while public
[main app-shell.tsx](https://github.com/GabrielTeixeira88/Finance-Tracker/blob/main/frontend/src/components/app-shell.tsx)
identifies adapted AGPL code. These are observed facts, not a determination that
every past distribution infringed. Counsel should assess existing source/build
distributions and any corrective steps; this review does not rewrite history or
assume a future replacement notice retroactively cures all issues.

## Evidence and boundaries

Primary v0.14 source revision: `92b4647f74ec51fbbb1a772db4f42ea91060c518`.
The cached checkout `.tmp/reference-v014` and its actual license/package files were
inspected. Earlier adaptations cite `d86c20194b4b61ad8133ce820739d5ac83f9045e`;
those source histories and attribution must also remain identifiable.

The [file inventory](licensing/SOURCE_FILE_INVENTORY.md) and its
[machine-readable data](licensing/SOURCE_FILE_INVENTORY.json) classify individual
files, declared licenses, provenance and unresolved evidence. This report does
not replace that inventory with a blanket claim that every file in one directory
has the same origin. Dependency metadata and bundled-asset evidence are recorded
in `docs/licensing/DEPENDENCY_LICENSES.json` and `docs/licensing/BUNDLED_ASSETS.md`.

| Material | Evidence | Assessment |
|---|---|---|
| Upstream application pages/components, translations, styles and retained source references | Source manifests, original paths/hashes, AGPL notices and upstream root license | AGPL-derived; rewriting API hooks/import paths or monetary arithmetic does not erase copied presentation expression |
| `packages/ui`-derived controls | Pinned [package.json](https://github.com/wealthfolio/wealthfolio/blob/92b4647f74ec51fbbb1a772db4f42ea91060c518/packages/ui/package.json) declares MIT, author Wealthfolio Team | Distinct permissive-license evidence; check each file and retain any more specific notices |
| Original FastAPI/SQLite domain services and local adapters | Local source, independently implemented exact financial services and tests | No automatic AGPL conclusion from HTTP/API use alone; provenance and combined-work analysis still matter |
| Backend's imported `ofxtools` 1.1.1 | Installed release license, metadata, PyPI provenance and direct import in `app/ingestion_parsers.py` | GPLv3 copyleft consideration independent of the frontend; preserve component terms and review combined-backend distribution |
| Original frontend modules linked into the adapted browser application | Local authorship evidence, imports and bundle composition | Original authors retain copyright; distribution of the combined AGPL-derived frontend needs a compatible whole-work grant |
| Five unchanged goal cover images | Manifest paths/hashes, outside upstream brand directory; no separate asset grant found | Repository-license inference, not independently verified image ownership; keep an explicit clearance question |
| Fonts and package assets | Their individual notices/licenses and package records | Preserve the applicable font/software conditions; do not replace them with the project license |
| Uncompiled vendor/reference code | Retained source files, including the postponed allocation worksheet | Still conveyed if published in Git, even when absent from the production bundle |

There is **no standalone `packages/ui/LICENSE`** in the inspected pinned checkout,
and the local public license directory does not currently supply a distinct full
Wealthfolio UI MIT notice. The MIT package declaration is meaningful evidence,
but the claimed complete MIT notice bundle needs correction/confirmation. Obtain
the upstream-authorized notice/copyright wording and preserve it; do not invent a
copyright grant or pretend the root AGPL file is that MIT notice.

## Attribution and legal-access gaps

The source manifests and many adapted-file headers provide substantial lineage,
but the record is not complete enough to call distribution compliant:

1. At review start, the blanket statement in `THIRD_PARTY_NOTICES.md` that no illustrations or
   complete components were copied was obsolete. Current source adaptations,
   translation catalogs, retained reference files and five goal covers contradict
   it. Preserve genuinely historical v0.13 statements as historical, and state the
   current v0.14 facts clearly. Attribution should describe copied/adapted work,
   not characterize it as wholly original because the backend differs. This factual
   statement has now been corrected and synchronized to the public notice copy;
   historical pass descriptions remain explicitly historical.
2. Identify mixed files and inferred rather than proven origins. An absent SPDX
   header is not proof of independent authorship. Supply relevant modification
   notices/dates and copyright information without removing upstream notices.
3. The current Settings About page exposes a generic repository link, a project-
   license-not-selected message and `/licenses/`. The public index lists license
   files but points to repository documents that are not necessarily bundled
   there. This is useful partial access, not a verified complete notice/source offer.
4. No verified, build-specific source artifact or prominent source offer for the
   modified v0.14 build is established by the current UI. A link to generic main
   is not evidence that users receive the exact uncommitted code shipped in a build.
5. Cover-image rights, full UI MIT notice wording and contributor authority remain
   clearance items. Hash identity proves which bytes were copied, not who owns them.

GNU's [license application guidance](https://www.gnu.org/licenses/gpl-howto.en.html)
distinguishes a license copy from an actual copyright/permission notice and asks
that copied authors' notices be retained. Applying an appropriate project grant
requires approval from the people entitled to license that original work.

## Combined frontend and separately authored backend

The current React application imports and integrates AGPL-derived components with
local modules into one browser program. **Absent a separate exception or a successful
replacement of all covered derivation, the legally cautious distribution position
is AGPL-3.0 for the combined frontend.** A permissive license for an independently
authored utility may survive for that utility in isolation; it cannot make the
whole copied frontend proprietary. This is an application of the inspected source
and license, subject to legal review, rather than a claim that file headers alone
settle the question.

FastAPI is a separate Python program communicating over HTTP/JSON. Serving the
frontend's static files or sharing a repository is not, alone, proof of one
copyright work. Conversely, calling an interface REST is not a guaranteed exemption.
The [GNU FAQ's aggregation discussion](https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation)
considers communication mechanism **and its semantics**; sufficiently intimate
coupling may change the assessment. Financial algorithms, abstract concepts and
independently written implementations must be distinguished from translated or
copied source expression. The notices describe `backend/app/net_worth_view.py` as
an independent exact projection inspired by presentation concepts; that description
does not itself prove either derivation or separation.

**Lawyer review required for Option B:** examine copied expression, API/control
coupling, build/runtime boundaries and the actual distribution before certifying
that a separately licensed backend remains independent. Option A can voluntarily
give the owner's backend AGPL permission without asserting that AGPL automatically
required it. Neither path requires disclosure of private ledgers, credentials or
OAuth tokens merely because they are processed by the application.

### Additional backend copyleft: ofxtools

`backend/app/ingestion_parsers.py` imports `OFXTree` from `ofxtools.Parser` into the
FastAPI process. Installed **ofxtools 1.1.1** metadata and
[PyPI's release record](https://pypi.org/project/ofxtools/1.1.1/) declare
`GPL-3.0-only`. Its actual installed `dist-info/licenses/LICENSE` grants version 3
or later. The source release's
[LICENSE at publishing commit 894cfe94fa5d0820c24c9435687b296895a36f81](https://github.com/csingley/ofxtools/blob/894cfe94fa5d0820c24c9435687b296895a36f81/LICENSE)
matches that text. PyPI's attestation links this exact publishing commit. Record
both pieces of evidence; do not silently rewrite the upstream metadata or grant.
The conservative GPLv3 analysis does not require resolving later-version permission.

This is a direct library integration, not merely a separate HTTP service. Based on
the [GNU linking guidance](https://www.gnu.org/licenses/gpl-faq.en.html#IfLibraryIsGPL),
treat distribution of the resulting backend as a GPL-compatible combined-work
question, even though the Python financial implementation is independently written.
**Option B cannot currently be advertised as a permissively licensed backend
application without addressing this GPL dependency.** An original module may have
its own compatible permissive grant while the distributed combined backend remains
subject to GPL terms. Private operation, network-only use and conveyance have
different triggers; plain GPL does not independently add AGPL's network clause.

[GPLv3 section 13](https://www.gnu.org/licenses/gpl-3.0.html#section13) and AGPLv3
section 13 permit their specified combinations while retaining the GPL-covered
part's GPL terms. This supports the recommended AGPL grant for owner-authored code
without pretending to relicense `ofxtools` itself. Preserve its copyright/license,
include required corresponding source when conveying the combination, and have
counsel confirm the final distribution scope. Replacing this parser would be a
separately approved functional/legal project, not an unannounced audit fix.

## Available paths

| Option | Frontend | Backend | Repository/redistribution | Future development and trade-off |
|---|---|---|---|---|
| **A. AGPL-3.0-only project grant (recommended)** | Give the appropriate integrated original work an AGPL grant; preserve upstream rights and permissive subcomponents | Owner voluntarily licenses independently authored backend under AGPL too | Replace restrictive project grant only after approval; supply notices and exact corresponding source for distributions | Closest to present source strategy; clear public open-source intent, continuing copyleft/source obligations |
| **B. Deliberate multi-license boundaries** | Combined AGPL frontend stays AGPL; independently reusable files may retain compatible permissive terms | Preserve GPL-compatible combined-backend distribution with `ofxtools`; original modules can have compatible grants, but a permissive application-wide claim needs removal/replacement or separate permission for this integration | Root becomes an accurate license map with scoped grants; repository co-location is not a substitute for the analysis | Enables separate reuse but requires precise scopes and counsel review; not a shortcut to a closed copied frontend or unrestricted GPL-linked backend |
| **C. Replace/remove AGPL derivation** | Reimplement/remove all affected expression, styles, translations, reference files and uncleared assets; retain only verified permissive material where appropriate | Independent engine can remain, but a different backend model must also address `ofxtools` GPL linkage | Reinventory the resulting work before selecting a different model; prior public copies remain a separate historical question | Largest cost and regression risk; clean replacement needs demonstrable provenance, not merely renaming wrappers |
| **D. Separate permission** | Obtain an explicit grant covering the actual files, revisions, modifications and distribution models | Include backend/product integration if the agreement requires it | Retain attribution and comply with permission terms plus unaffected third-party licenses | Potential commercial flexibility; costs, coverage and maintainers' authority must be verified; no permission exists just because a CLA exists |

Upstream's [CLA](https://github.com/wealthfolio/wealthfolio/blob/92b4647f74ec51fbbb1a772db4f42ea91060c518/CLA.md)
describes contributor grants to Teymz Inc. It is not a separate license for Finance
Tracker. For D, confirm that the negotiating party can authorize all relevant
contributions and assets, and obtain written terms. Do not assume an unverified
commercial exception or contact copyright holders without authorization.

## Distribution and deployment checklist

The following are proposed release gates, not actions already completed:

| Channel | Required preparation |
|---|---|
| Public GitHub source | Approved project grant and scoped exceptions; preserved copyrights/licenses; accurate modification/lineage notices; complete relevant source, build/config files and rights-cleared assets; review previously public material |
| Vite bundles, archives, installers or container images | Matching source access under an applicable AGPL section 6 method, required dependency source/notices, build scripts and clear version/revision mapping; include license material with the artifact |
| Remote web deployment | Apply browser-code conveyance duties and assess section 13's source offer for modified network-interactive covered software; make the exact corresponding source available without charge through a prominent customary means |
| Private local operation | Do not equate private self-use with a universal public-repository obligation; reevaluate if copies are given to others or remote users interact |

The [AGPL text](https://www.gnu.org/licenses/agpl-3.0.html), especially sections
0, 1, 4-6 and 13, is the authority. In practical release engineering, the source
must match the artifact, include what is needed to build/modify the covered work,
and satisfy the applicable license-access/source-access conditions. Merely keeping
a lockfile or linking an older upstream source tree is not a completed check.
Do not overstate this as an obligation to commit every development tool or secret.
The GNU FAQ addresses [matching source and binary hosting](https://www.gnu.org/licenses/gpl-faq.en.html#SourceAndBinaryOnDifferentSites)
and [AGPL corresponding source](https://www.gnu.org/licenses/gpl-faq.en.html#AGPLv3CorrespondingSource).

For legal UI, review AGPL's interactive-notice requirement including its exception
for upstream interfaces without those notices, then provide a convenient About /
Legal entry with appropriate copyright, no-warranty/redistribution information,
license access and build-specific source access. A bare SPDX identifier or a link
to upstream's source is not an assurance this application satisfies those conditions.
Packaged-user-product installation-information duties require case-specific review;
they are not automatically triggered by every ordinary self-hosted software install.

Brand rights remain separate. Upstream [TRADEMARKS.md](https://github.com/wealthfolio/wealthfolio/blob/92b4647f74ec51fbbb1a772db4f42ea91060c518/TRADEMARKS.md)
and [brand asset notice](https://github.com/wealthfolio/wealthfolio/blob/92b4647f74ec51fbbb1a772db4f42ea91060c518/assets/brand/README.md)
require distinct fork identity and do not license the official marks through AGPL.
Keep attribution descriptive; do not imply endorsement.

## Exact owner decisions and approval-gated changes

1. **Approve a licensing path and scope.** Recommended decision: AGPL-3.0-only for
   all original Finance Tracker code distributed as this project, retaining the
   third-party exceptions and their original grants. Alternatively choose B and
   specify a backend/original-module grant after legal boundary review, including
   the GPLv3 `ofxtools` integration and its conflicting only/or-later metadata.
2. **Authorize the actual grants.** Only then replace root `LICENSE`, add scoped
   license documents/SPDX permission notices for original work and update package /
   About license metadata. Confirm all relevant contributors/employer rights first.
3. **Approve the legal/source-access implementation.** Specify the copyright
   holder(s), selected grant, artifact revision/source archive, UI offer and
   retention/access plan. Implement and test these before a distribution; do not
   silently promise an archive that does not exist or points to another version.
4. **Resolve missing evidence.** Verify UI MIT notice wording, goal-cover rights and
   mixed/unresolved file lineage. Seek permission or replace uncleared material if
   adequate evidence cannot be established. Preserve source attribution meanwhile.
5. **Review existing public distribution and future publication separately.** Any
   historical corrective work requires legal advice and separate Git/publishing
   authorization. Do not delete tags, rewrite history or claim retroactive clearance.

Factual corrections and inventories can be prepared without a new grant. None of
the above licensing choices is approved merely by requesting this investigation.
**Status: licensing release blocker remains pending explicit owner approval and
resolution of the documented clearance/source-access requirements.**

## Research limitations

Safe notice work completed in this review: preserve the unchanged ofxtools release
notice plus standard GPLv3 text, link them in the existing public legal index, and
synchronize the current third-party copying scope. These changes supply component
information; they do not select a project license, clear upstream asset ownership
or implement a legally sufficient build-specific source offer. The dependency
inventory also identifies runtime packages whose published archives omit complete
license files; preserve/verify their upstream-authorized notices before packaging.
See [bundled assets and notice gaps](licensing/BUNDLED_ASSETS.md).

GNU direct page fetches timed out in this environment. Official indexed GNU text
was consulted, alongside the complete license copied from the actual pinned
checkout. GitHub connector reads verified the current public main files and pinned
UI package metadata; no remote changes were made. This report uses primary sources,
not license summaries or forum opinions. It does not independently verify every
upstream author's rights, every dependency's complete source package, past release
artifacts or historical compliance. Those limitations are not filled with an
assumption that metadata or attribution alone is sufficient.
