import { z } from "zod";
import { getEvent, eventStartsAt } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
import { createCalendar } from "@/lib/calendar";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ru";
  const d = getDictionary(locale);
  if (!z.uuid().safeParse(id).success) return new Response(d.rsvp.notFound, { status: 404 });
  try {
    const event = await getEvent(id);
    if (!event) return new Response(d.rsvp.notFound, { status: 404 });
    const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://literator-xi.vercel.app";
    const calendar = createCalendar({
      id,
      title: locale === "en" ? event.title_en : event.title_ru,
      description: `${locale === "en" ? event.description_en : event.description_ru}\n\n${d.calendar.descriptionNote}`,
      location: d.calendar.location,
      startsAt: new Date(eventStartsAt(event)),
      url: `${origin}/${locale}/afisha/${id}`,
    });
    return new Response(calendar, { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="literator-${id}-${locale}.ics"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response(d.calendar.unavailable, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
