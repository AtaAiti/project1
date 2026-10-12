"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import { useRouter } from "next/navigation";
const d = getDictionary("ru");
const t = d.adminExtra;
type Booking = {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  comment: string;
  status: "pending" | "confirmed" | "declined";
  created_at: string;
};

export default function BookingsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/bookings", {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || d.errors["error.generic"]);
        setRows(result.data);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : d.errors["error.generic"],
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  async function status(id: string, next: Booking["status"]) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || d.errors["error.generic"]);
      setRows((current) =>
        current.map((row) => (row.id === id ? result.data : row)),
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
    <main className="p-6 md:p-8">
      <h1 className="display text-3xl">{t.bookings}</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {t.liveData} · Asia/Bishkek
      </p>
      {error && (
        <p role="alert" className="mt-6">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-8" role="status">
          {t.loading}
        </p>
      ) : !rows.length ? (
        <p className="card mt-8 p-8">{t.noBookings}</p>
      ) : (
        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <article className="card p-5" key={row.id}>
              <div className="flex justify-between gap-4">
                <h2 className="display text-2xl">{row.name}</h2>
                <span className="text-sm text-[var(--gold)]">
                  {t[row.status]}
                </span>
              </div>
              <a className="mt-4 block text-sm" href={`tel:${row.phone}`}>
                {row.phone}
              </a>
              <p className="mt-2 text-sm">
                {row.date} · {row.time.slice(0, 5)} · {d.booking.guests}:{" "}
                {row.guests}
              </p>
              {row.comment && (
                <p className="mt-3 whitespace-pre-line text-sm text-[var(--text-secondary)]">
                  {row.comment}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-4">
                {row.status !== "confirmed" && (
                  <button
                    disabled={busy === row.id}
                    onClick={() => status(row.id, "confirmed")}
                    className="text-sm text-[var(--gold)]"
                  >
                    {t.confirm}
                  </button>
                )}
                {row.status !== "declined" && (
                  <button
                    disabled={busy === row.id}
                    onClick={() => status(row.id, "declined")}
                    className="text-sm"
                  >
                    {t.decline}
                  </button>
                )}
                {row.status !== "pending" && (
                  <button
                    disabled={busy === row.id}
                    onClick={() => status(row.id, "pending")}
                    className="text-sm"
                  >
                    {t.pending}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
