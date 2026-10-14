"use client";
import { useId, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import { reviewSubmissionSchema } from "@/lib/schemas";
export function ReviewForm({
  locale,
  demo = false,
}: {
  locale: string;
  demo?: boolean;
}) {
  const d = getDictionary(locale),
    t = d.experience,
    id = useId();
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState<keyof typeof d.errors | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const form = event.currentTarget,
      parsed = reviewSubmissionSchema.safeParse({
        ...Object.fromEntries(new FormData(form)),
        locale,
      });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === "rating"
          ? "validation.rating"
          : issue.message === "validation.required"
            ? "validation.required"
            : "validation.invalid",
      );
      return;
    }
    setBusy(true);
    try {
      if (!demo) {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const result = await response.json();
        if (!response.ok) {
          setError(
            result.errorKey in d.errors ? result.errorKey : "error.generic",
          );
          return;
        }
      }
      setSent(true);
      form.reset();
    } catch {
      setError("error.generic");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="leave-review"
      className="card mt-12 scroll-mt-24 p-6 md:p-8"
      aria-labelledby={id + "-title"}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="section-label">{d.publicUi.reviews}</p>
          <h2 id={id + "-title"} className="display mt-4 text-3xl">
            {t.reviewTitle}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            {t.reviewIntro}
          </p>
          {demo && (
            <p className="mt-4 text-sm text-[var(--gold)]">{t.reviewDemo}</p>
          )}
        </div>
        {sent ? (
          <p
            role="status"
            className="self-center rounded-lg border border-[var(--gold)]/40 bg-[var(--bg-input)] p-6 leading-7"
          >
            {demo ? t.reviewDemo : t.reviewSuccess}
          </p>
        ) : (
          <form onSubmit={submit} noValidate aria-busy={busy}>
            <fieldset disabled={busy} className="grid gap-5">
              <label className="text-sm">
                {t.reviewName}
                <input
                  name="author"
                  required
                  autoComplete="name"
                  maxLength={200}
                  className="input-field mt-2"
                />
              </label>
              <fieldset>
                <legend className="text-sm">{t.reviewRating}</legend>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label
                      key={n}
                      className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-2 text-[var(--gold)] has-[:checked]:border-[var(--gold)] has-[:checked]:bg-[var(--bg-elevated)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--gold)]"
                    >
                      <input
                        required
                        name="rating"
                        type="radio"
                        value={n}
                        className="sr-only"
                        aria-label={`${n} ${t.reviewStars}`}
                      />
                      <span aria-hidden="true">{n} ★</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="text-sm">
                {t.reviewText}
                <textarea
                  name="text"
                  required
                  maxLength={5000}
                  rows={4}
                  className="input-field mt-2"
                />
              </label>
              <div aria-hidden="true" className="absolute -left-[10000px]">
                <label htmlFor={id + "-website"}>{d.booking.honeypot}</label>
                <input
                  id={id + "-website"}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-[var(--error)]">
                  {d.errors[error]}
                </p>
              )}
              <button className="btn-gold justify-self-start">
                {busy ? t.reviewSending : t.reviewSubmit}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
}
