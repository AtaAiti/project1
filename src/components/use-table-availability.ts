"use client";
import { useEffect, useState } from "react";
import { bookingTimeError } from "@/lib/booking-time";

export function useTableAvailability(date: string, time: string, guests: string) {
  const [result, setResult] = useState<{ key: string; available?: string[]; error?: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${date}/${time}/${guests}/${revision}`;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && Number(guests) >= 1 && Number(guests) <= 20 && !bookingTimeError(date, time);
  const demo = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  useEffect(() => {
    if (!valid || demo) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/tables?${new URLSearchParams({ date, time, guests })}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Availability unavailable");
        const data = await response.json();
        if (!Array.isArray(data.available)) throw new Error("Invalid availability");
        if (!controller.signal.aborted) setResult({ key, available: data.available });
      } catch {
        if (!controller.signal.aborted) setResult({ key, error: true });
      }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [date, time, guests, key, valid, demo]);
  const current = result?.key === key ? result : null;
  return { status: demo ? "demo" : !valid ? "idle" : !current ? "loading" : current.error ? "error" : "ready", available: current?.available ?? [], retry: () => setRevision((value) => value + 1) };
}
