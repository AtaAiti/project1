import Link from "next/link";
import { redirect } from "next/navigation";
import { authorizeAdmin } from "@/lib/server/admin";
import { getDictionary } from "@/lib/dictionaries";
import { sortUpcoming, type EventItem } from "@/lib/content";
import { ContentImage } from "@/components/content-image";

export default async function AdminDashboard() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200) redirect("/admin/login");
  const d = getDictionary("ru");
  const t = d.adminExtra;
  const [menu, events, gallery, reviews, pending, bookings] = await Promise.all(
    [
      auth.supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .order("date", { ascending: true }),
      auth.supabase
        .from("gallery_photos")
        .select("id", { count: "exact", head: true }),
      auth.supabase.from("reviews").select("rating").eq("status", "published"),
      auth.supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      auth.supabase
        .from("bookings")
        .select("id,name,date,time,guests,status")
        .order("created_at", { ascending: false })
        .limit(5),
    ],
  );
  if (
    [menu, events, gallery, reviews, pending, bookings].some(
      (result) => result.error,
    )
  )
    return (
      <main className="p-8">
        <h1 className="display text-3xl">{t.dashboardTitle}</h1>
        <p role="alert" className="mt-6">
          {d.errors["error.generic"]}
        </p>
      </main>
    );
  const ratings = reviews.data || [];
  const average = ratings.length
    ? (
        ratings.reduce((sum, row) => sum + Number(row.rating), 0) /
        ratings.length
      ).toFixed(1)
    : "—";
  const next = sortUpcoming((events.data || []) as EventItem[])[0];
  const stats = [
    [t.menuCount, menu.count || 0],
    [t.eventCount, events.data?.length || 0],
    [t.photoCount, gallery.count || 0],
    [t.pendingCount, pending.count || 0],
    [t.publishedReviews, ratings.length],
    [t.averageRating, average],
  ];
  return (
    <main className="p-6 md:p-8">
      <h1 className="display text-3xl">{t.dashboardTitle}</h1>
      <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">
        {t.dashboardText}
      </p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, value]) => (
          <article key={label} className="card p-5">
            <h2 className="text-sm">{label}</h2>
            <strong className="display mt-4 block text-4xl text-[var(--gold)]">
              {value}
            </strong>
          </article>
        ))}
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="card p-6">
          <h2 className="display text-2xl">{t.recentBookings}</h2>
          {!bookings.data?.length ? (
            <p className="mt-5 text-sm">{t.noBookings}</p>
          ) : (
            bookings.data.map((row) => (
              <div
                key={row.id}
                className="mt-5 border-b border-[var(--border)] pb-4"
              >
                <p>{row.name}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {row.date} · {row.time.slice(0, 5)} · {d.booking.guests}:{" "}
                  {row.guests} ·{" "}
                  {t[row.status as "pending" | "confirmed" | "declined"]}
                </p>
              </div>
            ))
          )}
          <Link
            href="/admin/bookings"
            className="mt-6 inline-block text-sm text-[var(--gold)]"
          >
            {t.bookings} →
          </Link>
        </article>
        <article className="card overflow-hidden">
          {next?.image_url && (
            <div className="relative aspect-video">
              <ContentImage
                src={next.image_url}
                alt={next.title_ru}
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          )}
          <div className="p-6">
            <h2 className="display text-2xl">{t.nextEvent}</h2>
            {next ? (
              <>
                <p className="mt-4 text-sm">
                  {next.date} · {next.time.slice(0, 5)} · Asia/Bishkek
                </p>
                <h3 className="display mt-3 text-xl">{next.title_ru}</h3>
              </>
            ) : (
              <p className="mt-5 text-sm">{t.noUpcoming}</p>
            )}
            <Link
              href="/admin/events"
              className="mt-6 inline-block text-sm text-[var(--gold)]"
            >
              {d.admin.events} →
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
