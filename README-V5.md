# MWG24 V5 repair workspace — NOT VERIFIED

This workspace is derived from the uploaded V4 (4) source. It is **not** a production-ready final V5 release.

The original `package.json` and Railway configuration are preserved. A lockfile was absent in the uploaded source; no lockfile is invented here. Install dependencies on a build host with npm registry access before attempting tests. Use a copy of a database for all verification.

Minimal verification steps: set `SESSION_SECRET` (>=32 chars), `ADMIN_PASSWORD`, and temporary `DATA_DIR`; install dependencies and generate/commit the lockfile, run `npm test`, run `node tests/v5-static-audit.js`, start locally, then perform authenticated CRUD, CSRF, mobile and regression testing. Do not deploy without completing the missing checks in TEST-RESULTS.md.
