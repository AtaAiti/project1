"use client";

import { useEffect, useId, useState } from "react";
import { addVenueDays, bookingEndTime, bookingSlots, venueToday } from "@/lib/booking-time";
import { getDictionary } from "@/lib/dictionaries";

export function VisitPicker({ locale, date, time, guests, onChange, disabled = false, maxGuests = 20 }: {
  locale: string; date: string; time: string; guests: string;
  onChange: (patch: { date?: string; time?: string; guests?: string }) => void;
  disabled?: boolean; maxGuests?: number;
}) {
  const t = getDictionary(locale).visit;
  const id = useId();
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const current = venueToday();
      setToday(current);
      setMonth((date || current).slice(0, 7));
    });
    return () => cancelAnimationFrame(frame);
  }, [date]);
  const slots = date ? bookingSlots(date) : [];
  const start = month ? new Date(`${month}-01T12:00:00Z`) : null;
  const days = start ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate() : 0;
  const offset = start ? (start.getUTCDay() + 6) % 7 : 0;
  const fmt = (value: string, options: Intl.DateTimeFormatOptions) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: "UTC" });
  function chooseDate(value: string) {
    const available = bookingSlots(value);
    onChange({ date: value, time: available.includes(time) ? time : available[0] || "" });
  }
  function moveMonth(delta: number) {
    if (!start) return;
    const next = new Date(start);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(next.toISOString().slice(0, 7));
  }
  return <fieldset disabled={disabled} className="visit-picker @container min-w-0 rounded-xl border border-[var(--gold-border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
    <legend className="px-2 text-sm font-bold text-[var(--gold)]">{t.title}</legend>
    <p className="mb-4 text-sm text-[var(--text-secondary)]">{t.subtitle}</p>
    <div className="grid gap-5 @[36rem]:grid-cols-2">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {today && [today, addVenueDays(today, 1)].map((value, i) => <button type="button" key={value} aria-pressed={date === value} onClick={() => chooseDate(value)} className="visit-chip">{i === 0 ? t.today : t.tomorrow}</button>)}
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" disabled={!month || month <= today.slice(0, 7)} aria-label={t.previousMonth} onClick={() => moveMonth(-1)} className="h-10 w-10 rounded hover:bg-[var(--bg-elevated)]">‹</button>
            <p className="font-bold capitalize" aria-live="polite">{month ? fmt(`${month}-01`, { month: "long", year: "numeric" }) : "…"}</p>
            <button type="button" aria-label={t.nextMonth} onClick={() => moveMonth(1)} className="h-10 w-10 rounded hover:bg-[var(--bg-elevated)]">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label={t.date}>
            {Array.from({ length: 7 }, (_, i) => <span key={`week-${i}`} className="py-2 text-center text-xs text-[var(--text-secondary)]">{fmt(addVenueDays("2026-11-02", i), { weekday: "short" })}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const value = `${month}-${String(i + 1).padStart(2, "0")}`;
              return <button type="button" key={value} disabled={value < today} aria-label={fmt(value, { dateStyle: "full" })} aria-pressed={date === value} aria-current={value === today ? "date" : undefined} onClick={() => chooseDate(value)} className="visit-day">{i + 1}</button>;
            })}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <label htmlFor={`${id}-date`} className="block text-sm">{t.date}</label>
        <input id={`${id}-date`} name="date" type="date" required min={today} value={date} onChange={(e) => chooseDate(e.target.value)} className="input-field mt-2 [color-scheme:dark]" />
        <label htmlFor={`${id}-time`} className="mt-4 block text-sm">{t.time}</label>
        <select id={`${id}-time`} name="time" required value={time} onChange={(e) => onChange({ time: e.target.value })} className="input-field mt-2">
          <option value="">{t.choose}</option>
          {time && !slots.includes(time) && <option value={time} disabled>{time}</option>}
          {slots.map((slot) => <option key={slot} value={slot}>{slot} — {bookingEndTime(slot)}</option>)}
        </select>
        {date && !slots.length && <p className="mt-2 text-sm text-[var(--warning)]">{t.noSlots}</p>}
        <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label={t.time}>
          {slots.filter((slot) => ["12:00", "14:00", "18:00", "19:30"].includes(slot)).map((slot) => <button type="button" key={slot} onClick={() => onChange({ time: slot })} aria-pressed={time === slot} className="visit-chip px-1">{slot}</button>)}
        </div>
        <label htmlFor={`${id}-guests`} className="mt-4 block text-sm">{t.guests}</label>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" disabled={Number(guests) <= 1} aria-label={`${t.guests} −1`} onClick={() => onChange({ guests: String(Math.max(1, Number(guests) - 1)) })} className="visit-chip w-11">−</button>
          <input id={`${id}-guests`} name="guests" type="number" required min="1" max={maxGuests} value={guests} onChange={(e) => onChange({ guests: e.target.value })} className="input-field min-w-0 text-center" />
          <button type="button" disabled={Number(guests) >= maxGuests} aria-label={`${t.guests} +1`} onClick={() => onChange({ guests: String(Math.min(maxGuests, Number(guests || 0) + 1)) })} className="visit-chip w-11">+</button>
        </div>
      </div>
    </div>
    <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">{t.duration}</p>
    {date && time && <p aria-live="polite" className="mt-3 rounded-lg border border-[var(--gold-border)] p-3 text-sm text-[var(--gold)]">{fmt(date, { day: "numeric", month: "long" })} · {time}–{bookingEndTime(time)} · {t.guests}: {guests}</p>}
  </fieldset>;
}
