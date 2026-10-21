# Public demo deployment decision

**Implemented and tested: local demo only. No public URL or hosted-session isolation
is claimed. No deployment was performed.** The repository has no selected hosting
account, domain, TLS configuration or public session manager. A static frontend host
alone cannot run this Python/SQLite application. Local demo restrictions intentionally
reject remote origins; do not remove them to publish the personal application.

## Proposed hosted design, not implemented

A separately approved public service would issue opaque, server-generated session
identities in Secure/HttpOnly/SameSite cookies. Each visitor gets a private temporary
SQLite copy of a validated read-only synthetic baseline. A server-owned session map,
never a request path or arbitrary filename, selects the database. All APIs, downloads,
query caches and reset operations must remain session scoped. Two concurrent visitors
must be able to edit and reset without observing or changing each other's state.

Run behind TLS and a same-origin reverse proxy, as an unprivileged OS user in an
isolated application directory with no personal database or host secrets mounted.
Keep one SQLite writer process per session or a coordinated session writer gate.
Session expiry and eviction must wait for active requests, dispose connections and
remove only verified session directories. Use bounded capacity and return a clear
busy response instead of sharing a database when capacity is exhausted.

Required controls before publishing:

- Explicit POST CSRF/Origin validation and session authorization on every route.
- Bounded session count, lifetime, disk, request size, upload size, CPU and request rate;
  backpressure for expensive history/analytics queries and reset frequency.
- No Gmail OAuth, OS vault, market provider, outbound financial network or personal
  credentials. Deny outbound access at the deployment boundary too.
- Only allowlisted synthetic imports for public visitors; disable arbitrary uploads,
  filesystem browsing, personal exports and filesystem/configuration endpoints.
- Short-lived synthetic sessions, no financial request logging, no analytics/tracking,
  and a clear notice that public sessions are temporary and not for personal data.
- Content security/response headers, dependency review, proxy body/time limits,
  crash recovery, disk exhaustion behavior and monitoring without payload logs.

## Acceptance tests required before public launch

Two independent browser sessions must show isolation for reads, writes, imports,
reset, downloads and expiration. Include concurrent reset/write requests, stale
session replay, fixation/tampering, path traversal/link attacks, cleanup during active
requests, crashes/restarts, capacity limits and cross-origin requests. Demonstrate that
OAuth/provider endpoints and host credential access are impossible. These public tests
are not present because the public-session implementation does not exist yet.

## Operations and cost considerations

Hosting needs a continuously available Python runtime, local ephemeral writable disk,
TLS/domain support and enough RAM/CPU for concurrent analytics. Static-only free hosting
is insufficient; container/server hosting is possible after authorization and review.
Expect baseline storage plus one roughly 2.5 MB initial database per active visitor,
WAL/temp files, retained reset generations and process memory. This is a local measured
starting point, not a capacity guarantee or a hosting quote. Profile actual concurrent
load before choosing a service or pricing plan. No hosting accounts or secrets have
been added. v0.13 owns security/deployment readiness if a public demo is approved.
