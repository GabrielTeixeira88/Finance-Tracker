# Finance Tracker source access

Owner-authored Finance Tracker code is AGPL-3.0-only. Third-party components retain
their separate terms; see this directory's notices and the repository NOTICE.md.
The program is supplied without warranty, as described in the applicable licenses.

Public source repository:
https://github.com/GabrielTeixeira88/Finance-Tracker

This v0.14 distribution is the Git source tree, not a separately published binary
or hosted service. Select the commit associated with your checkout/PR to obtain
the exact source. A clone includes the application, adapted source, build/startup
instructions, package-lock.json, uv.lock, SQLAlchemy/Alembic migrations and notices.
Dependency versions and source locations are recorded in the lockfiles and
docs/licensing/DEPENDENCY_LICENSES.json. Install instructions are in README.md.

For a local checkout, `git rev-parse HEAD` identifies its commit and `git status`
identifies local modifications. Preserve those modifications when supplying source.
No source offer for a different, unpublished, locally modified build is implied.

If you distribute compiled bundles, containers or a modified network deployment:

1. Make the preferred form for modification of that exact version available,
   including local changes and required build/installation material.
2. Preserve applicable notices, license texts and dependency source obligations.
3. Use an applicable AGPL/GPL conveyance method; where section 13 applies, offer
   network users prominent access to Corresponding Source at no charge.
4. Identify the exact artifact revision/archive and maintain required access.
   Do not substitute unrelated main-branch source or a license-only page.
5. Review any applicable installation-information obligations for the actual
   product/distribution. This source-only merge does not certify future packaging.

The OFX parser's ofxtools dependency remains GPL-covered. Its release source is
https://github.com/csingley/ofxtools/tree/894cfe94fa5d0820c24c9435687b296895a36f81
and its preserved copyright/license notice is ofxtools-COPYRIGHT.txt.
The standard GPLv3 text is GPL-3.0.txt. Preserve the dependency's terms separately.

Corresponding Source does not require publishing private financial databases,
bank exports, API keys, OAuth credentials, tokens or other user data. Keep those
outside source archives. No tag, GitHub Release or deployment is created by v0.14
finalization; any later publishing requires the repository owner's authorization.
