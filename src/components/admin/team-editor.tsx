"use client";
import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import { LoadingCards } from "@/components/loading-cards";
const d = getDictionary("ru"),
  t = d.team;
export function TeamEditor() {
  const [rows, setRows] = useState<{ email: string; created_at: string }[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [email, setEmail] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/team", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            d.errors[result.errorKey as keyof typeof d.errors] ||
              d.errors["error.generic"],
          );
        setRows(result.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(d.errors["error.generic"]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function write(method: "POST" | "DELETE", target: string) {
    if (busy) return;
    if (method === "DELETE" && !window.confirm(t.confirmRemove)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/team", {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: target }),
        }),
        result = await response.json();
      if (!response.ok)
        throw new Error(
          d.errors[result.errorKey as keyof typeof d.errors] ||
            d.errors["error.generic"],
        );
      if (method === "DELETE") {
        setRows(rows.filter((row) => row.email !== target));
        setMessage(t.removed);
      } else {
        setMessage(
          result.owner
            ? t.ownerAlready
            : result.invitationSent
              ? t.added
              : result.existingAccount
                ? t.existing
                : t.emailFailed,
        );
        if (
          !result.owner &&
          !rows.some((row) => row.email === target.toLowerCase())
        )
          setRows([
            {
              email: target.trim().toLowerCase(),
              created_at: new Date().toISOString(),
            },
            ...rows,
          ]);
        setEmail("");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : d.errors["error.generic"],
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-4xl p-6 md:p-8">
      <p className="section-label">{d.admin.title}</p>
      <h1 className="display mt-4 text-4xl">{t.title}</h1>
      <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
        {t.intro}
      </p>
      <form
        className="card mt-8 flex flex-wrap items-end gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void write("POST", email.trim());
        }}
        aria-busy={busy}
      >
        <label className="min-w-0 flex-1 text-sm">
          {t.email}
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-field mt-2"
          />
        </label>
        <button disabled={busy || loading} className="btn-gold">
          {busy ? t.sending : t.add}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-5 text-[var(--error)]">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-5 leading-7">
          {message}
        </p>
      )}
      <p className="mt-6 text-sm text-[var(--text-secondary)]">{t.ownerNote}</p>
      {loading ? (
        <div className="mt-8">
          <LoadingCards label={t.loading} />
        </div>
      ) : !rows.length ? (
        <p className="card mt-8 p-6">{t.empty}</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {rows.map((row) => (
            <li
              key={row.email}
              className="card flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <span className="break-all">{row.email}</span>
              <button
                disabled={busy}
                onClick={() => write("POST", row.email)}
                className="text-sm text-[var(--gold)]"
              >
                {t.inviteAgain}
              </button>
              <button
                disabled={busy}
                onClick={() => write("DELETE", row.email)}
                className="text-sm text-[var(--gold)]"
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
