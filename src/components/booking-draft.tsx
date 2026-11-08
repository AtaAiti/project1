"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { z } from "zod";

export type BookingDraft = {
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: string;
  comment: string;
};
const emptyDraft: BookingDraft = { name: "", phone: "", date: "", time: "19:30", guests: "2", comment: "" };
type DraftContext = {
  draft: BookingDraft;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  selectedTable: string;
  selectTable: (id: string) => void;
  clearDraft: () => void;
};
const Context = createContext<DraftContext | null>(null);

/** Kept only in memory across client navigation; personal data is not stored on the device. */
export function BookingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedTable, selectTable] = useState("");
  const updateDraft = useCallback((patch: Partial<BookingDraft>) => setDraft((current) => ({ ...current, ...patch })), []);
  return <Context.Provider value={{
    draft,
    updateDraft,
    selectedTable,
    selectTable,
    clearDraft: () => { setDraft(emptyDraft); selectTable(""); },
  }}>{children}</Context.Provider>;
}

/** Restore shareable visit details; personal contact data stays in memory. */
export function RestoreBookingVisit({ query }: { query: Record<string, string | string[] | undefined> }) {
  const { updateDraft } = useBookingDraft();
  const date = typeof query.date === "string" && z.iso.date().safeParse(query.date).success ? query.date : undefined;
  const time = typeof query.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(query.time) ? query.time : undefined;
  const guests = typeof query.guests === "string" && /^(?:[1-9]|1\d|20)$/.test(query.guests) ? query.guests : undefined;
  useEffect(() => {
    updateDraft({ ...(date ? { date } : {}), ...(time ? { time } : {}), ...(guests ? { guests } : {}) });
  }, [date, time, guests, updateDraft]);
  return null;
}

export function useBookingDraft() {
  const context = useContext(Context);
  if (!context) throw new Error("BookingDraftProvider is required");
  return context;
}
