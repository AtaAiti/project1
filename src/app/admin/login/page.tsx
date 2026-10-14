"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import { createClient } from "@/lib/supabase/browser";
import { adminEmailSchema } from "@/lib/schemas";
const d = getDictionary("ru"),
  t = d.auth;
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false),
    [signingIn, setSigningIn] = useState(false),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);
  async function resetPassword() {
    if (sending || cooldown) return;
    const parsed = adminEmailSchema.safeParse({ email });
    if (!parsed.success) {
      setError(d.errors["validation.email"]);
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        }),
        result = await response.json();
      if (!response.ok) {
        setError(
          d.errors[result.errorKey as keyof typeof d.errors] || t.resetError,
        );
        if (response.status === 429) {
          const retry = Number(response.headers.get("Retry-After"));
          setCooldown(
            Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 60,
          );
        }
        return;
      }
      setMessage(t.resetSent);
      setCooldown(60);
    } catch {
      setError(t.connectionError);
    } finally {
      setSending(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    setError("");
    setMessage("");
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          error.status === 429
            ? d.errors["error.emailRateLimited"]
            : t.invalidCredentials,
        );
        return;
      }
      const access = await fetch("/api/admin/menu_items");
      if (access.status === 403) {
        setError(t.accessDenied);
        return;
      }
      if (!access.ok) {
        setError(d.errors["error.generic"]);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError(t.connectionError);
    } finally {
      setSigningIn(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="card page-enter w-full max-w-lg p-8 md:p-10">
        <Link
          href="/ru"
          className="mb-8 inline-block text-sm text-[var(--gold)]"
        >
          ← {t.backToSite}
        </Link>
        <p className="section-label">{t.eyebrow}</p>
        <h1 className="display mt-4 text-4xl">{t.loginTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          {t.intro}
        </p>
        <form
          onSubmit={submit}
          className="mt-8 grid gap-5"
          aria-busy={signingIn}
        >
          <label className="text-sm">
            {t.email}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field mt-2"
              type="email"
              autoComplete="username"
              required
            />
          </label>
          <label className="text-sm">
            {t.password}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field mt-2"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-[var(--error)]">
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="text-sm leading-6 text-[var(--success)]"
            >
              {message}
            </p>
          )}
          <button disabled={signingIn || sending} className="btn-gold w-full">
            {signingIn ? t.signingIn : t.login}
          </button>
        </form>
        <button
          type="button"
          disabled={sending || signingIn || cooldown > 0}
          onClick={resetPassword}
          className="mt-5 min-h-11 text-left text-sm text-[var(--gold)] underline"
        >
          {sending
            ? t.sending
            : cooldown > 0
              ? [
                  t.resendIn,
                  cooldown >= 60 ? Math.ceil(cooldown / 60) : cooldown,
                  cooldown >= 60 ? t.minutes : t.seconds,
                ].join(" ")
              : t.reset}
        </button>
        <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">
          {t.resetHelp}
        </p>
        <p className="mt-6 border-t border-[var(--border)] pt-5 text-xs text-[var(--text-muted)]">
          {t.protected}
        </p>
      </section>
    </main>
  );
}
