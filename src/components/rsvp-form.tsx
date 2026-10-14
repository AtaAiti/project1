"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import { rsvpSchema, phoneSchema } from "@/lib/schemas";
export function RsvpForm({
  eventId,
  capacity,
  seatsTaken,
  locale,
  demo = false,
}: {
  eventId: string;
  capacity: number | null;
  seatsTaken: number;
  locale: string;
  demo?: boolean;
}) {
  const d = getDictionary(locale),
    t = d.rsvp;
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<keyof typeof d.errors | null>(null),
    [success, setSuccess] = useState(false);
  const [left, setLeft] = useState<number | null>(
    capacity === null ? null : Math.max(0, capacity - seatsTaken),
  );
  const [demoPhones, setDemoPhones] = useState<string[]>([]);
  const soldOut = left === 0;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || soldOut) return;
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    setError(null);
    setSuccess(false);
    const parsed = rsvpSchema.safeParse({ ...input, event_id: eventId });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === "phone"
          ? "validation.phone"
          : issue.path[0] === "guests"
            ? "validation.guests"
            : issue.message === "validation.required"
              ? "validation.required"
              : "validation.invalid",
      );
      return;
    }
    setBusy(true);
    try {
      if (demo) {
        if (parsed.data.website) {
          setSuccess(true);
          return;
        }
        const phone = phoneSchema.parse(parsed.data.phone);
        if (demoPhones.includes(phone)) {
          setError("rsvp.duplicate");
          return;
        }
        if (left !== null && parsed.data.guests > left) {
          setError("rsvp.notEnoughSeats");
          return;
        }
        setDemoPhones([...demoPhones, phone]);
        if (left !== null) setLeft(left - parsed.data.guests);
      } else {
        const response = await fetch("/api/rsvp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const result = await response.json();
        if (!response.ok) {
          const key = result.errorKey as keyof typeof d.errors;
          setError(key in d.errors ? key : "error.generic");
          if (key === "rsvp.soldOut") setLeft(0);
          return;
        }
        setLeft(result.seatsLeft);
        router.refresh();
      }
      setSuccess(true);
      form.reset();
    } catch {
      setError("error.generic");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card p-6" aria-labelledby="rsvp-title">
      <h2 id="rsvp-title" className="display text-3xl">
        {t.title}
      </h2>
      {capacity !== null && (
        <p className="mt-3" aria-live="polite">
          {t.seatsTaken}: {capacity - (left ?? capacity)} / {capacity}
        </p>
      )}
      {demo && (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          {t.demo} {t.demoReset}
        </p>
      )}
      {soldOut ? (
        <p role="status" className="mt-5">
          {t.soldOut}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
          <fieldset disabled={busy} className="grid gap-4">
            <label>
              {t.name}
              <input
                name="name"
                maxLength={200}
                autoComplete="name"
                required
                className="input-field mt-2"
              />
            </label>
            <label>
              {t.phone}
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder={t.phonePlaceholder}
                className="input-field mt-2"
              />
            </label>
            <label>
              {t.guests}
              <input
                name="guests"
                type="number"
                min={1}
                max={6}
                defaultValue={1}
                required
                className="input-field mt-2"
              />
            </label>
            <div
              aria-hidden="true"
              className="absolute h-0 w-0 overflow-hidden"
            >
              <label>
                {t.website}
                <input name="website" autoComplete="off" tabIndex={-1} />
              </label>
            </div>
            <button className="btn-gold" type="submit">
              {busy ? t.sending : t.submit}
            </button>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-[var(--error)]">
          {d.errors[error]}
        </p>
      )}
      {success && (
        <p role="status" className="mt-4 text-[var(--success)]">
          {t.success}
        </p>
      )}
    </section>
  );
}
