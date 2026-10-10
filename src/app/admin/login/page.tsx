"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter(); const [email, setEmail] = useState("admin@literator.ru"); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); const { error: authError } = await createClient().auth.signInWithPassword({ email, password }); if (authError) { setError("Неверный email или пароль"); return; } router.push("/admin"); }
  return <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-6"><form onSubmit={submit} className="card w-full max-w-md p-8"><p className="section-label">Система управления</p><h1 className="display mt-3 text-4xl">Вход в кабинет</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">Управляйте меню, афишей, галереей и отзывами.</p><label className="mt-8 block text-xs text-[var(--text-secondary)]">Электронная почта<input value={email} onChange={(event) => setEmail(event.target.value)} className="input-field mt-2" type="email" required /></label><label className="mt-4 block text-xs text-[var(--text-secondary)]">Пароль<input value={password} onChange={(event) => setPassword(event.target.value)} className="input-field mt-2" type="password" required /></label>{error && <p className="mt-4 text-sm text-[var(--error)]">{error}</p>}<button className="btn-gold mt-6 w-full">ВОЙТИ</button><p className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">Сессия защищена Supabase Auth.</p></form></main>;
}
