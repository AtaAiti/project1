# PR 1 foundation review

The existing booking API accepted loosely validated data and could return an error after saving a booking when Telegram failed. Admin writes trusted request bodies, and DB changes had no migration history. This change adds strict shared Zod schemas, Kyrgyzstan phone normalization, a honeypot, explicit booking statuses, migration files, server-side admin checks, and a media upload helper without upload UI. Notifications cannot turn an accepted booking into a failed response.

## Scope and files

- `supabase/migrations/20261013000100_0001_baseline.sql`: already-deployed baseline.
- `supabase/migrations/20261013000200_0002_foundation.sql`: status backfill/constraint/index, bounded RPC cleanup and grants, media bucket/policies.
- `supabase/schema.sql`: matching reference snapshot.
- `src/lib/schemas.ts`, `phone.ts`, `honeypot.ts`, `booking-validation.ts`, `booking-errors.ts`, `rate-limit.ts`: shared contracts.
- `src/lib/server/`: admin authorization, localized errors, Telegram and Storage helpers.
- `src/app/api/booking/route.ts`, `api/admin/[resource]/route.ts`, `api/admin/media/route.ts`: hardened endpoints.
- `src/app/admin/(protected)/`: server authorization layout and existing screens; URLs unchanged.
- `src/components/booking-form.tsx`, `src/app/booking/`: labelled bilingual forms, hidden honeypot, shared client/server validation.
- `dictionaries/ru.json`, `en.json`: shared errors and messages for touched forms/editors/auth.
- `tests/`, `vitest.config.mts`, package manifests: Vitest and PostgreSQL migration checks.

## Apply SQL before rollout

Existing project: run **0002** in Supabase SQL Editor. New project: run **0001 then 0002**. Do not mark a migration as applied just because its file exists. Running 0002 twice preserves confirmed/declined bookings. Unknown legacy statuses are deliberately backfilled to pending, with no row deletion.

The existing service-role API credentials cannot execute arbitrary SQL. A direct PostgreSQL connection or Supabase management access is required for automated application; otherwise SQL Editor is the supported manual step. Do not deploy the change and claim Storage/constraints ready before live application and verification.

## Environment

No new credentials are required. Existing variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_ID` (primary) or `ADMIN_EMAIL` (case-insensitive fallback), optional `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Set secrets securely in each deployment separately. Venue timezone is `Asia/Bishkek`; phone numbers are Kyrgyzstan only.

## Checks

Run `npm test`, `npm run lint`, `npm run build`. SQL tests use a real isolated PostgreSQL engine (PGlite) with minimal Supabase-managed Storage fixtures. They verify migration repeatability, backfill, RPC threshold/expiry, grants and Storage policies. These are not live Supabase migration results.

Verified in this task: **85 Vitest tests pass**, along with lint and production build. Temporary live Supabase accounts exercised the new app through a local production server. The allowed test admin opened `/admin` (200), the other account received 403 for admin pages/API/media; strict menu create/PATCH preserved omitted fields and rejected unknown fields; unknown resources were 404 for every method. Kyrgyzstan phone normalization and pending status persisted; a honeypot request returned fake success; the sixth valid booking returned 429. The six test rows and two users were deleted. Telegram was disabled in that isolated test server to avoid sending a batch of test notifications. Storage SQL/policies and constraints were verified in PGlite, not applied to the live project yet.

Playwright browser smoke checks passed on the local production build: English labels, invalid phone rejected before submission, normalized payload, localized 429 response, non-focusable honeypot, Russian required-field errors and admin recovery button. Recovery redirect, URL token cleanup, password confirmation, update success and expired-link feedback were checked with mocked Supabase Auth responses; the owner's password was not changed.

Mobile Lighthouse results on the same local production build: `/booking?locale=en` performance **99**, accessibility **100**; `/ru/contacts` performance **97**, accessibility **100**. Reports were generated at `/tmp/literator-booking-lighthouse.json` and `/tmp/literator-contacts-lighthouse.json`. These are representative changed-page measurements, not an audit of every route or a production Vercel performance guarantee.

Manual/integration checks, against an authorized test environment:

1. Valid `0700123456` booking persists as `+996700123456` with pending status; clients render localized success.
2. Invalid phone, calendar date/time, missing required field, guests outside 1–20 and extra JSON fields return translated error keys in both languages.
3. Filled `website` returns fake success; no booking, rate-limit call or notification occurs.
4. Six valid quick submissions from one IP: first five succeed, sixth is 429; only test bookings are removed afterward.
5. A second Auth user receives 403 on `/admin` and all admin API methods. Public login/recovery pages remain accessible.
6. Unknown resources are 404; invalid/malformed bodies are 400; valid partial updates preserve omitted values. A DELETE error must not remove a row from the editor locally.
7. RPC execution is denied to anon/authenticated; direct browser content mutations and bookings insertion are denied. Expired limit windows reset.
8. Admin media upload accepts a small valid JPEG/PNG/WebP and yields a public URL; rejects fake MIME, SVG and >5 MiB; non-admin cannot upload. No upload UI is added.
9. Telegram unconfigured, rejected, timeout and network failures leave the booking accepted. No credential-containing exception is logged.
10. Keyboard checks: each field has a label, errors are announced, honeypot is excluded from tab order, submit controls have visible focus. Verify mobile performance separately; no Lighthouse score is claimed without an actual run.

## Deferred

RSVP/capacity, RSVP RPC/seeds/UI, Telegram inline buttons/webhook, Book of the Month UI/table, menu filters, ICS, SEO/analytics are not implemented here. The RSVP and book resource contracts are reserved; generic RSVP inserts/updates are disabled. Existing age gate, header and design tokens are untouched. Existing unrelated legacy screens/marketing content are not rewritten as part of foundation hardening.
