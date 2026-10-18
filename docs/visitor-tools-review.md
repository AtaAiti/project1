# Cookie preferences, map, calendar and table selection

Visitors can choose their privacy preferences, load an interactive Bishkek map, download an event calendar entry and select one of eight demonstration tables before completing «Литературный резерв».

## Behavior

- Cookie banner: RU/EN, essential-only and allow-map choices, persisted in `literator-consent-v1` localStorage. No analytics or advertising cookies are introduced. Footer settings reopen the choice; withdrawing map consent removes the iframe. Without browser storage, the preference works for the current page session. Existing age and login storage remain essential.
- Contacts: OpenStreetMap embed only mounts after explicit consent. The map shows central Bishkek without a venue marker because the address is fictional. Attribution remains within the map. A separate link opens the map in a new tab.
- Event detail: a download link calls `/api/events/[id]/calendar?locale=ru|en`. Only published events export. The .ics file contains the localized title/description, stable UID, event URL and the UTC equivalent of the Asia/Bishkek start time. An unknown end time is not invented. Text is escaped and lines are folded at 75 UTF-8 bytes. Missing/unpublished events return 404; backend failure returns 503.
- `/ru/tables` and `/en/tables`: a demonstration plan with eight numbered tables seating 2, 4 or 6, windows, bookshelves, bar and entrance. Table buttons work with keyboard and expose selection. Confirmation opens `/booking?locale=…&table=T…`; the form displays the selection and permits changing it.
- The optional `table_id` is validated against `src/lib/venue-tables.ts`; party size cannot exceed the selected table. The server adds a canonical table description to the existing booking comment. It is visible in the admin booking list and the Telegram notification. No database migration or new environment variables are needed.
- Table choice is a preference in a **pending request**, not a real-time availability guarantee. The UI explains administrator confirmation. This change does not introduce time slots, automatic holds or concurrent table inventory management.

## Validation

- 156 tests pass, including valid/invalid table requests, persisted table preferences, notification content, calendar localization, invalid/missing events, backend errors, time-zone conversion, UTF-8 folding and property injection resistance.
- ESLint and production build pass.
- Production-build browser checks with live Supabase: RU/EN consent persists; no map requests occur before consent; actual map tiles and zoom work; withdrawing consent removes the embed. All eight tables are selectable, the chosen table reaches the booking form, oversized parties are rejected and the accepted pending booking contains the canonical table and visitor comment. The temporary booking was deleted; Telegram was disabled for this live test. Notification contents are covered by route tests.
- Mobile 390px and desktop 1440px screenshots checked; no horizontal overflow. Invalid table URLs display a recovery message. A real published event downloads a valid calendar file.
