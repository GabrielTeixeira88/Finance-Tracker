# Finance Tracker licensing and attribution

Copyright (c) 2026 Finance Tracker contributors.

The repository owner approved **AGPL-3.0-only** for owner-authored Finance Tracker
code on 2026-11-10. The complete, unmodified GNU Affero General Public License
version 3 is in [LICENSE](LICENSE). This grant covers the original frontend,
FastAPI backend, scripts and accompanying owner-authored project material, subject
to the separately licensed components/data identified below and in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This software comes WITHOUT ANY WARRANTY, including implied warranties of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE, to the extent permitted by
law. You may copy, modify and redistribute covered work under the applicable license.

## Third-party material

- Adapted Wealthfolio application source remains AGPL-covered. Its copyright
  belongs to its authors/contributors; local adapters do not erase that lineage.
- The upstream UI package declares MIT. Preserve its declaration, standard MIT
  permission text, original notices and the file-level source references.
- `ofxtools` retains its GPLv3 terms. Its metadata says GPL-3.0-only while its
  actual release notice permits version 3 or later. The release notice is retained
  verbatim. GPLv3/AGPLv3 section 13 treatment does not replace the dependency's GPL
  grant or remove its source/notice obligations.
- Other MIT/ISC/BSD/Apache components, OFL fonts and separately licensed market
  observations retain their own terms. Treasury data's ODbL obligations remain
  separate from the program license. Private market exports are not distributed.

Five upstream goal-cover illustrations are excluded from this distribution
pending separate rights clearance. Their historical hashes/lineage are retained;
the goal cards use neutral surfaces. No upstream logos or branding are adopted.
Wealthfolio is a trademark of Teymz Inc. Finance Tracker is not an official
Wealthfolio product and is not endorsed by its authors.

## Modification and source record

The v0.14 modifications finalized on 2026-11-10 adapt frontend layouts/components,
translations, interactions and charts to Finance Tracker's local FastAPI/SQLite
services and exact monetary representations. Source headers and
`frontend/src/vendor/wealthfolio/SOURCE.json` retain the original paths, revisions,
hashes and adaptation notes; do not describe copied components as independently
authored. The pre-approval file inventory under `docs/licensing/` is preserved as
historical evidence, not a declaration that its old restrictive licensing remains.

The current distribution is source on GitHub, including build instructions,
dependency locks, migrations and the original/adapted source. See
[source-access instructions](frontend/public/licenses/SOURCE_ACCESS.md).
Distributors of built or network-accessible modified versions must provide the
corresponding source for their exact version using an applicable license method;
a generic main-branch link is not proof of a matching artifact. Private ledgers,
credentials and OAuth tokens are not part of Corresponding Source.

Owner approval does not certify every upstream right or retroactively resolve
past distributions. Concrete disputes, unusual combinations, artifact-specific
obligations and past-distribution questions should be reviewed by qualified counsel.
