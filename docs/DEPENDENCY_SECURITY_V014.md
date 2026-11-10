# Development dependency security review

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](FINALIZATION_V014.md). No local tests or audits were rerun.

Review date: 2026-11-10. No financial/application logic or dependency constraints
changed during this investigation.

## Result

**Ten audit entries represent one underlying advisory**, not ten independent CVEs.
The vulnerable implementation is minimatch **10.2.6**; nine parent-package entries
inherit that finding. [GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249)
affects minimatch `>=7.0.0 <11.0.1`. The first patched release is **11.0.1**;
the current registry latest is **11.0.6**. Severity is moderate.

## Package matrix

Every row concerns GHSA-g3hv-75wg-m249 / CVE-2026-118764 and development/CI tooling.
Parent affected ranges are npm audit propagation ranges, not separate implementation
vulnerabilities. The common remedy is a supported parent range accepting patched
minimatch; there is no compatible fix in the reviewed ranges today.

| Package | Installed | npm affected range | Dependency chain to minimatch |
|---|---|---|---|
| `minimatch` | 10.2.6 | 7.0.0–11.0.0 | ESLint / config-array / typescript-estree → minimatch |
| `eslint` | 10.12.0 | >=10.0.0-alpha.0 | root dev → eslint → minimatch |
| `@eslint/js` | 10.0.1 | >=10.0.1 | root dev → @eslint/js → eslint peer → minimatch |
| `@eslint/config-array` | 0.23.5 | >=0.23.0 | root dev → eslint → config-array → minimatch |
| `typescript-eslint` | 8.71.0 | <=8.72.2 | root dev → typescript-eslint → typescript-estree → minimatch |
| `@typescript-eslint/eslint-plugin` | 8.71.0 | 6.16.0–8.72.2 | typescript-eslint → eslint-plugin → type-utils/utils → typescript-estree → minimatch |
| `@typescript-eslint/parser` | 8.71.0 | 6.16.0–8.72.2 | typescript-eslint → parser → typescript-estree → minimatch |
| `@typescript-eslint/type-utils` | 8.71.0 | 6.16.0–8.72.2 | typescript-eslint → eslint-plugin → type-utils → typescript-estree → minimatch |
| `@typescript-eslint/typescript-estree` | 8.71.0 | 6.16.0–8.72.2 | typescript-eslint → typescript-estree → minimatch |
| `@typescript-eslint/utils` | 8.71.0 | 6.16.0–8.72.2 | typescript-eslint → utils → typescript-estree → minimatch |

The [machine-readable matrix](licensing/DEPENDENCY_ADVISORIES.json) also records
each package's environment, patch, compatibility, remediation and exposure assessment.

## Patch availability and changes

The official npm registry was queried: latest ESLint **10.14.0** still requires
minimatch `^10.2.6`; `@eslint/config-array` **0.23.5** uses `^10.2.4`;
`@typescript-eslint/typescript-estree` **8.72.2** uses `^10.2.2`.
Compatible parent updates therefore do not resolve this advisory. No unrelated
dependency/lockfile churn was performed.

Overriding minimatch to 11 crosses the parents' major constraints. npm audit's
proposed downgrade to ESLint 9.39.5 / TypeScript lint tooling 8.36.0 is a separate,
potentially breaking toolchain change. Neither was applied. No audit checks,
peer validation or security controls were disabled.

Vitest **4.1.12** from the previous audit is already installed and retained. It
resolves the prior [manual-mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)
and [Windows traversal](https://github.com/advisories/GHSA-xp26-3454-mjgp) findings.
**New dependency patches in this review: none available for the remaining advisory.**

## Exposure in the actual workflows

The advisory requires attacker-controlled globs and `optimizationLevel >= 2`.
Installed minimatch defaults to level 1 and enters the affected first-phase
preprocessing at level 2 or higher. Reviewed callers:

- `eslint/lib/eslint/eslint-helpers.js`: options `{ dot: true }`.
- `@eslint/config-array/dist/cjs/index.cjs`: default `{ dot: true }`; inspected
  internal overrides do not enable level 2.
- `@typescript-eslint/typescript-estree/dist/useProgramFromProjectService.js`:
  `minimatch(filePath, pattern, { dot: true })`.
- `frontend/eslint.config.js` supplies repository-owned globs. Imported bank data,
  Gmail bodies, transaction strings and network parameters do not become lint globs.

**No exploitable path was demonstrated in the reviewed workflows.** This is
conditional source analysis, not a claim that every future configuration or
transitive caller is safe. The vulnerable package remains installed and the
advisory remains open. No denial-of-service payload was executed.

Production audit reports **zero vulnerabilities**, and `npm ls --omit=dev minimatch`
has no production chain. The issue concerns developer linting and CI, not deployed
browser/FastAPI financial behavior. This is distinct from the patched Vitest
test-server vulnerability.

CI uses `pull_request`, read-only repository permissions, no persisted checkout
credentials, blank provider credentials and a 15-minute frontend timeout. Pull
requests can already modify executable npm/config code. These controls reduce
exposure but do not remove the advisory. Do not run untrusted forks with developer
secrets or expose linting as an API accepting arbitrary external globs.

## Recommended remediation

Keep the advisory visible. Prefer supported ESLint/typescript-eslint releases
that accept patched minimatch. Then rerun audit, peer validation, lint, all tests,
TypeScript and build. A major toolchain migration or reviewed upstream backport
can be considered separately; do not force an override just to clear the count.
Before release, resolve the finding or explicitly review/accept this development-only risk.

## Validation

Fresh frontend tests, lint, formatting, TypeScript/build and dependency audits were
executed for this review. Exact final results appear in the
[review summary](COMPLIANCE_SECURITY_V014.md). Backend financial logic is unchanged;
no personal/demo database was opened or reset by this task.

The [dependency license inventory](licensing/DEPENDENCY_LICENSES.json) is separate:
a clean security audit does not establish copyright/license compatibility.
