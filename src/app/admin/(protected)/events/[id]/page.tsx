import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/server/admin";
import { getDictionary } from "@/lib/dictionaries";
import { EventRsvps } from "@/components/admin/event-rsvps";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const auth = await authorizeAdmin();
  if (auth.status !== 200) notFound();
  const [{ data: event, error: eventError }, { data: rows, error: rsvpError }] =
    await Promise.all([
      auth.supabase
        .from("events")
        .select("id,title_ru,date,time,capacity")
        .eq("id", id)
        .single(),
      auth.supabase
        .from("event_rsvps")
        .select("id,name,phone,guests,created_at")
        .eq("event_id", id)
        .order("created_at", { ascending: false }),
    ]);
  const d = getDictionary("ru");
  if (eventError || !event) notFound();
  return (
    <main className="p-6 md:p-8">
      <Link href="/admin/events" className="text-[var(--gold)]">
        ← {d.admin.events}
      </Link>
      <h1 className="display mt-6 text-3xl">{event.title_ru}</h1>
      <p className="mt-3">
        {event.date} · {event.time} · Asia/Bishkek
      </p>
      {rsvpError ? (
        <p role="alert" className="mt-8">
          {d.errors["error.generic"]}
        </p>
      ) : (
        <EventRsvps rows={rows || []} capacity={event.capacity} />
      )}
    </main>
  );
}
