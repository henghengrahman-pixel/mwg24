# MWG24 V4 — Audit and repairs, 2026-10-24

**RELEASE STATUS: BLOCKED — NOT PRODUCTION VERIFIED.** This is an incremental repair of the user-supplied V4 archive, not the requested fully verified V3-to-V4 release.

## Confirmed gaps
- Regex-based HTML sanitization did not implement a real allowlist; changed to `sanitize-html` and defense-in-depth at rendering.
- Login previously accepted session regeneration errors; now fails closed and requires successful persistence.
- Production DATA_DIR was optional; now required explicitly.
- Outbound redirect could fail if click logging failed; now redirects independently, with operational logging.
- Click handler stored raw IP; new events leave IP null. Existing stored IP data is not deleted or modified.
- Affiliate management still lacks categories, placements, campaigns, full analytics, conversion CSV import, and complete CRUD screens.
- CSRF prevention, session management policy, UI regression tests, DB backup/rollback automation, image URLs migration, bot filtering, data retention and production load testing remain unfinished.
- Original archive did not contain the V3 baseline. Do not claim V3 preservation verified.

## Tests performed
- `npm run check`: PASS (JavaScript syntax only).
- `npm run test:security`: PASS (8 static invariants, not dynamic security tests).
- `npm test`: BLOCKED; required dependencies absent. `npm install --offline` returned ENOTCACHED for better-sqlite3. No production runtime verification.
- `npm run test:integration`: NOT RUN (same dependency blocker).
- Lighthouse, browser/mobile, Railway restart persistence: NOT RUN.

## Before deployment
Install dependencies in a suitable Node environment, run full functional and security tests, review new sanitizer behavior, configure persistent Railway volume and secure credentials, audit CSRF, and complete missing affiliate modules. Do not deploy this package as a verified production release.
