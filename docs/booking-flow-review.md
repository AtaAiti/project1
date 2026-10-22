# Mobile cookie banner and booking flow review

The mobile cookie panel now keeps its explanation under a native «Подробнее» / “More details” disclosure. Both consent buttons stay available while collapsed; desktop retains the full explanation. Consent and external-map behavior are unchanged.

The table-to-booking review found and fixed these problems:

- Date and time previously received only format checks, allowing past requests and arrivals outside opening hours. The shared client/server validator now checks the actual future instant in Asia/Bishkek and enforces 10:00 ≤ arrival < 22:00. The date picker uses the Bishkek date even when the visitor is in another time zone. Errors remain dictionary keys in both languages.
- Changing tables discarded name, phone, date/time, party size and comments. An in-memory provider preserves the draft across client navigation, including from Contacts. Personal details are not stored in localStorage/sessionStorage. A full page reload clears the draft; successful submission clears the draft and table preference.
- The change-table and back links restore the current table on the plan. Visitors can remove a preference or select a table from an ordinary booking form. Choosing a smaller table preserves the party size and explains the capacity mismatch rather than silently reducing the group.
- A missing/unknown table query previously fell back to a normal booking form. It now requires an explicit choice to pick a valid table or book without a preference. The API continues rejecting unknown IDs and parties larger than the chosen table.
- A compact mobile action shows the selected table and a visible continuation link. It renders in a body portal so page-entry transforms cannot place a fixed action outside the viewport.
- An in-flight guard prevents double submission from rapid repeated events. Inputs are disabled during submission; a failed request leaves the draft intact for retry. On success, the receipt shows the requested date, time, guest count and table.

Table selection remains a preference in a pending booking. The administrator confirms availability. This patch does not add table inventory or automatically confirm requests. No SQL migration or new environment variable is required.

## Validation

- 172 automated tests pass, including opening/closing boundaries, past bookings, Bishkek day rollover, table capacity and server rejection before persistence/Telegram.
- ESLint and production build pass.
- Browser with live Supabase: all eight table buttons work by keyboard; selection, removal and re-selection preserve the draft; capacity/past/closed-hours failures produce no POST. A simulated API error preserves all inputs. Two rapid submit events send one request, saving one pending booking with T8, 6 guests and the original comment. The receipt displays the table; success clears the draft and selection. The temporary booking was deleted and Telegram was disabled for the live check.
- Invalid table links require an explicit recovery choice. RU/EN layouts at 320/390/768/1440px have no horizontal overflow; mobile cookie details are collapsed and expandable, desktop text stays visible. No personal draft fields appear in localStorage.
