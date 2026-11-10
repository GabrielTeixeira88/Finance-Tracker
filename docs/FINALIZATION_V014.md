# v0.14.0 source finalization

Decision date: 2026-11-10. The owner approved Option A and explicitly authorized
committing the complete v0.14 branch, pushing it and merging through the normal
GitHub checks. No tag, GitHub Release, deployment or provider refresh is authorized.

## License and notices

- Owner-authored frontend, FastAPI backend, scripts and project material are
  **AGPL-3.0-only**. Root `LICENSE` is the complete unmodified GNU AGPLv3 text;
  `NOTICE.md`, package metadata and the served legal pages identify the grant.
- Adapted Wealthfolio application source remains attributed to its authors and
  contributors. The pinned revision is `92b4647f74ec51fbbb1a772db4f42ea91060c518`;
  earlier revisions and original hashes remain in the source manifest. The About
  screen provides copyright, rights/warranty and legal/source-access links.
- Shared UI retains its existing MIT declaration, preserved upstream package
  metadata and standard permission text. No missing copyright year or holder is
  invented. Available runtime notices, including nested vendored dependencies,
  are collected in the public legal directory; metadata-only grants are labeled.
- GPL-covered ofxtools is unchanged. Preserve its exact release notice, GPLv3
  text and source link. Its metadata says GPL-3.0-only while its release text
  permits v3-or-later. GPL/AGPL section 13 combination treatment does not replace
  the dependency's GPL grant or obligations. OFL, MIT/ISC/Apache and data licenses
  also remain separate.
- Five goal-cover PNGs are excluded pending independent image-rights clearance.
  Neutral covers preserve the cards and workflows. Historical paths/hashes stay
  in the inventory; those entries do not mean the images are now distributed.
- Wealthfolio attribution is factual, not endorsement. No upstream branding is
  adopted. Treasury/official observation terms remain distinct from program terms;
  restricted ETF exports, private data and credentials are not distributed.

The licensing reports and file-level inventory are retained as **pre-approval
snapshots**. Their old All Rights Reserved findings, classifications and hashes
describe that snapshot. This document, root grant and current notices supersede
the old pending approval state without rewriting the historical evidence.

## Distribution scope and remaining legal cautions

This action distributes a Git source tree with application/adapted source,
dependency locks, migrations and build/startup instructions. Exact source is
selected by checkout/PR commit, not an unspecified future main branch. See
[source access](../frontend/public/licenses/SOURCE_ACCESS.md) and
[third-party attribution](../THIRD_PARTY_NOTICES.md).

Future compiled/container/network distributions require their exact Corresponding
Source and appropriate prominent access/offer, retained notices and applicable
installation information. This merge does not certify a future artifact or hosted
service. Financial databases and credentials are not Corresponding Source.

Owner approval supplies the original-work grant, not ownership of third-party
material. Upstream package declarations and retained notices are evidence rather
than universal legal clearance. No concrete unresolvable material rights conflict
was identified in finalization; uncertain illustrations were excluded. Qualified
counsel should assess disputed authorship, unusual combinations, exact deployment
obligations and historical public distributions. The new grant is not a claim of
retroactive legal cure or a legal opinion.

## Dependency risk accepted for this merge

The owner explicitly accepted ten moderate **development-only package entries**
from one minimatch advisory, GHSA-g3hv-75wg-m249 / CVE-2026-118764. The recorded
installed 10.2.6 remains vulnerable; accepting risk does not fix it. No compatible
parent-range patch was available in the completed investigation; no exploitable
path was demonstrated in the reviewed default-level/repository-owned glob calls.
This is conditional exposure analysis, not a safety guarantee. Track supported
parent updates; do not force major overrides or disable checks. See the retained
[advisory matrix](DEPENDENCY_SECURITY_V014.md).

The dependency graph is preserved. Frontend lock metadata alone changes for the
approved project license/version; backend lock regeneration was offline and left
its dependency graph unchanged. No new dependency audit was run.

## Validation and finalized scope

The owner instructed that completed local validation must not be repeated. The
following are **historical results**, not executions during finalization:

- 573 backend and 330 frontend tests passed; lint/format/type/build passed.
- Fresh/populated migrations, financial checks and browser workflows passed.
- 42 screens reviewed; 504 visual captures and 28 targeted retests recorded.
- Production npm audit reported zero; the development advisory above remains.

Finalization performs only file/diff/privacy and non-executing consistency review,
necessary metadata/notice edits and authorized Git operations. GitHub automatic CI
runs normally; failed required checks or unsafe conflicts must stop the merge.
Screenshots, temporary reference checkouts, database files, caches, builds and
private exports are excluded from the new commit.

Version 0.14.0 identifies the finalized development source milestone. Completed
migrations, audit records, unified demo, exact-money services and preserved scope
boundaries are included; postponed engines remain postponed. The licensing edits
do not change financial posting/calculations. This document records preparation;
the final GitHub PR/merge status must be verified from Git rather than inferred.
