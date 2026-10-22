"use client";
import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
const d = getDictionary("ru"),
  t = d.telegramAdmin;
export default function TelegramPage() {
  const [status, setStatus] = useState<{
      ready: boolean;
      connected: boolean;
      username: string | null;
    } | null>(null),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    const r = await fetch("/api/admin/telegram", { cache: "no-store" });
    if (!r.ok) throw new Error(d.errors["error.generic"]);
    setStatus(await r.json());
  }
  useEffect(() => {
    const controller = new AbortController();
    async function initial() {
      try {
        const r = await fetch("/api/admin/telegram", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw new Error();
        const result = await r.json();
        if (!controller.signal.aborted) setStatus(result);
      } catch {
        if (!controller.signal.aborted) setError(d.errors["error.generic"]);
      }
    }
    void initial();
    return () => controller.abort();
  }, []);
  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    setLink("");
    try {
      const r = await fetch("/api/admin/telegram/link", { method });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || d.errors["error.generic"]);
      if (body.url) setLink(body.url);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : d.errors["error.generic"]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-3xl p-6 md:p-8">
      <h1 className="display text-3xl">{t.title}</h1>
      <p className="mt-4 text-[var(--text-secondary)]">{t.intro}</p>
      {error && (
        <p role="alert" className="mt-4">
          {error}
        </p>
      )}
      <div className="card mt-6 space-y-5 p-6" aria-busy={busy}>
        {!status ? (
          <p role="status">{t.loading}</p>
        ) : (
          <>
            <p>
              {!status.ready
                ? t.notReady
                : status.connected
                  ? t.connected
                  : t.notConnected}
            </p>
            {status.username && <p>@{status.username}</p>}
            {status.ready && (
              <div className="flex flex-wrap gap-4">
                <button
                  className="btn-gold"
                  disabled={busy}
                  onClick={() => void act("POST")}
                >
                  {t.connect}
                </button>
                <button
                  className="btn-outline-gold"
                  disabled={busy}
                  onClick={() =>
                    void load().catch(() => setError(d.errors["error.generic"]))
                  }
                >
                  {d.bot.refresh}
                </button>
                {status.connected && (
                  <button
                    className="btn-outline-gold"
                    disabled={busy}
                    onClick={() => void act("DELETE")}
                  >
                    {t.disconnect}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {link && (
          <div className="space-y-3">
            <a
              className="btn-gold"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.open}
            </a>
            <p className="text-sm">{t.expires}</p>
          </div>
        )}
      </div>
    </main>
  );
}
