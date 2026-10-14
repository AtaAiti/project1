"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
type Rsvp = {
  id: string;
  name: string;
  phone: string;
  guests: number;
  created_at: string;
};
export function EventRsvps({
  rows,
  capacity,
}: {
  rows: Rsvp[];
  capacity: number | null;
}) {
  const d = getDictionary("ru"),
    t = d.rsvp,
    router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  const taken = rows.reduce((sum, row) => sum + row.guests, 0);
  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/admin/event_rsvps", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          d.errors[result.errorKey as keyof typeof d.errors] ||
            d.errors["error.generic"],
        );
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : d.errors["error.generic"],
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="mt-8">
      <h2 className="display text-2xl">{t.list}</h2>
      <p className="mt-4">
        {t.seatsTaken}: {taken}
        {capacity !== null ? ` / ${capacity}` : ` · ${t.unlimited}`}
      </p>
      {capacity !== null && (
        <p>
          {t.seatsLeft}: {Math.max(0, capacity - taken)}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4">
          {error}
        </p>
      )}
      {!rows.length ? (
        <p className="card mt-6 p-6">{t.empty}</p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((row) => (
            <article className="card p-5" key={row.id}>
              <h3 className="display text-xl">{row.name}</h3>
              <a className="mt-3 block" href={`tel:${row.phone}`}>
                {row.phone}
              </a>
              <p>
                {t.guests}: {row.guests}
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {t.createdAt}:{" "}
                {new Intl.DateTimeFormat("ru-RU", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Asia/Bishkek",
                }).format(new Date(row.created_at))}{" "}
                · Asia/Bishkek
              </p>
              <button
                disabled={busy !== null}
                className="mt-4 text-[var(--gold)]"
                onClick={() => remove(row.id)}
              >
                {t.remove}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
