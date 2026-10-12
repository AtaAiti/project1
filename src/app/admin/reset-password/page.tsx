"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useRef, useState } from "react";

function recoveryClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    isSingleton: false,
    auth: { detectSessionInUrl: false },
  });
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialization = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const client = recoveryClient();
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.slice(1));
        const code = url.searchParams.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (hash.has("error") || url.searchParams.has("error")) throw new Error("Invalid recovery link");
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken && hash.get("type") === "recovery") {
          const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }
        window.history.replaceState(null, "", "/admin/reset-password");
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) throw new Error("No recovery session");
        return true;
      } catch {
        window.history.replaceState(null, "", "/admin/reset-password");
        return false;
      }
    }
    initialization.current ??= initialize();
    void initialization.current.then((valid) => {
      if (!active) return;
      if (valid) setReady(true);
      else setError("Ссылка недействительна или истекла. Запросите новое письмо на странице входа.");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError("Пароль должен содержать минимум 8 символов."); return; }
    if (password !== confirmation) { setError("Пароли не совпадают."); return; }
    setLoading(true); setError("");
    try {
      const client = recoveryClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) { setError("Не удалось сохранить пароль. Проверьте требования к паролю или запросите новую ссылку."); return; }
      await client.auth.signOut();
      setSaved(true);
    } catch { setError("Не удалось подключиться. Попробуйте позже."); }
    finally { setLoading(false); }
  }

  return <main className="grid min-h-screen place-items-center px-6"><section className="card w-full max-w-md p-8"><h1 className="display text-3xl">{saved ? "Пароль сохранён" : "Новый пароль"}</h1>{saved ? <p className="mt-4 text-sm">Теперь войдите с вашим email и новым паролем.</p> : ready ? <form onSubmit={submit} className="mt-6 grid gap-4"><label className="text-sm">Новый пароль<input className="input-field mt-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="text-sm">Повторите пароль<input className="input-field mt-2" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button disabled={loading} className="btn-gold">{loading ? "Сохраняем..." : "Сохранить пароль"}</button></form> : !error && <p className="mt-4 text-sm">Проверяем ссылку...</p>}{error && <p role="alert" className="mt-4 text-sm text-[var(--error)]">{error}</p>}<Link href="/admin/login" className="mt-6 inline-block text-sm text-[var(--gold)] underline">Перейти ко входу</Link></section></main>;
}
