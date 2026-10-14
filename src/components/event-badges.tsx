import { getDictionary } from "@/lib/dictionaries";
import type { EventItem } from "@/lib/content";
export function EventBadges({
  event,
  locale,
}: {
  event: EventItem;
  locale: string;
}) {
  const t = getDictionary(locale).rsvp;
  return (
    <div className="my-3 flex flex-wrap gap-2 text-sm text-[var(--gold)]">
      {event.is_club_meeting && (
        <span className="rounded border border-[var(--gold)] px-2 py-1">
          {t.club}
        </span>
      )}
      {event.capacity != null && (
        <span className="rounded border border-[var(--border)] px-2 py-1">
          {event.capacity - event.seats_taken > 0
            ? `${t.seatsLeft}: ${event.capacity - event.seats_taken}`
            : t.soldOut}
        </span>
      )}
    </div>
  );
}
