"use client";
import { trapDialogTab } from "@/lib/dialog-focus";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { getDictionary, type Locale } from "@/lib/dictionaries";
export function AgeGate({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  const d = getDictionary(locale),
    t = d.ageGate;
  useEffect(() => {
    let confirmed = false;
    try {
      confirmed = localStorage.getItem("age-confirmed") === "true";
    } catch {
      /* A visitor can still confirm for this page session. */
    }
    const frame = requestAnimationFrame(() => setOpen(!confirmed));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (open) {
      node?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        node?.close();
        document.body.style.overflow = previous;
      };
    }
    node?.close();
  }, [open]);
  function confirm() {
    try {
      localStorage.setItem("age-confirmed", "true");
    } catch {
      /* Confirmation still works when storage is blocked. */
    }
    dialog.current?.close();
    setOpen(false);
    document.querySelector<HTMLAnchorElement>("[data-skip-content]")?.focus();
  }
  return (
    <dialog
      onKeyDown={trapDialogTab}
      ref={dialog}
      aria-labelledby={id + "-title"}
      aria-describedby={id + "-description"}
      onCancel={(e) => e.preventDefault()}
      className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-[var(--gold-border)] bg-[var(--bg-card)] px-6 py-8 text-center text-[var(--text-primary)] backdrop:backdrop-blur-sm"
    >
      <Image
        src="/brand/literator-gold.png"
        alt={d.publicUi.brand}
        width={1679}
        height={937}
        sizes="240px"
        className="mx-auto h-auto w-60"
      />
      <p className="mt-3 text-xs uppercase tracking-widest text-[var(--gold)]">
        {d.tagline}
      </p>
      <h2 id={id + "-title"} className="display mt-6 text-2xl">
        {t.title}
      </h2>
      <p
        id={id + "-description"}
        className="mt-3 text-sm leading-6 text-[var(--text-secondary)]"
      >
        {t.description}
      </p>
      <div className="mt-7 grid gap-3">
        <button type="button" onClick={confirm} className="btn-gold">
          {t.yes}
        </button>
        <button
          type="button"
          onClick={() => window.location.assign("https://www.google.com")}
          className="btn-outline-gold"
        >
          {t.no}
        </button>
      </div>
    </dialog>
  );
}
