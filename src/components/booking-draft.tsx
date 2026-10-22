"use client";

import { createContext, useContext, useState } from "react";

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
  return <Context.Provider value={{
    draft,
    updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
    selectedTable,
    selectTable,
    clearDraft: () => { setDraft(emptyDraft); selectTable(""); },
  }}>{children}</Context.Provider>;
}

export function useBookingDraft() {
  const context = useContext(Context);
  if (!context) throw new Error("BookingDraftProvider is required");
  return context;
}
