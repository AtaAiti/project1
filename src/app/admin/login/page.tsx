"use client";

import { getDictionary } from "@/lib/dictionaries";
const t = getDictionary("ru").auth;

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  async function resetPassword() {
    if (!email.trim()) { setError(t.emailRequired); return; }
    setSending(true); setError(""); setMessage("");
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/reset-password` });
      if (error) { setError(t.resetError); return; }
      setMessage(t.resetSent);
    } catch { setError(t.connectionError); }
    finally { setSending(false); }
  }
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); const { error: authError } = await createClient().auth.signInWithPassword({ email, password }); if (authError) { setError(t.invalidCredentials); return; } router.push("/admin"); }
  return <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-6"><form onSubmit={submit} className="card w-full max-w-md p-8"><p className="section-label">{t.eyebrow}</p><h1 className="display mt-3 text-4xl">{t.loginTitle}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{t.intro}</p><label className="mt-8 block text-xs text-[var(--text-secondary)]">{t.email}<input value={email} onChange={(event) => setEmail(event.target.value)} className="input-field mt-2" type="email" required /></label><label className="mt-4 block text-xs text-[var(--text-secondary)]">{t.password}<input value={password} onChange={(event) => setPassword(event.target.value)} className="input-field mt-2" type="password" required /></label>{error && <p role="alert" className="mt-4 text-sm text-[var(--error)]">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-[var(--success)]">{message}</p>}<button className="btn-gold mt-6 w-full">{t.login}</button><button type="button" disabled={sending} onClick={resetPassword} className="mt-5 text-sm text-[var(--gold)] underline">{sending ? t.sending : t.reset}</button><p className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">{t.protected}</p></form></main>;
}
