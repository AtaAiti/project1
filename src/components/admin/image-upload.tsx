"use client";

import { useId, useRef, useState } from "react";
import { ContentImage } from "@/components/content-image";
import { getDictionary } from "@/lib/dictionaries";

const d = getDictionary("ru"), t = d.menuPhotos;
export function ImageUpload({ label, value, disabled, onChange, onBusyChange }: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploading = useRef(false);
  async function upload(file: File | undefined) {
    if (!file || uploading.current) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 4 * 1024 * 1024) { setError(d.errors["validation.file"]); return; }
    uploading.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const data = new FormData();
      data.append("folder", "menu"); data.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok || typeof result.data?.url !== "string") {
        setError(result.errorKey === "validation.file" ? d.errors["validation.file"] : d.errors["error.generic"]);
        return;
      }
      onChange(result.data.url);
    } catch { setError(d.errors["error.generic"]); }
    finally { uploading.current = false; setBusy(false); onBusyChange(false); }
  }
  return <section aria-label={label} className="rounded-lg border border-[var(--border)] p-4">
    <p className="text-sm font-bold">{label}</p>
    {value ? <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded"><ContentImage src={value} alt={t.preview} sizes="(max-width:768px) 90vw, 480px" /></div> : <p className="mt-3 text-sm text-[var(--text-secondary)]">{t.required}</p>}
    {value.startsWith("/images/stock/") && <p className="mt-3 text-xs text-[var(--text-secondary)]">{t.placeholder}</p>}
    <label htmlFor={id} className="mt-4 block text-sm">{busy ? t.uploading : value ? t.replace : t.choose}</label>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} className="mt-2 block max-w-full text-sm file:mr-3 file:rounded file:border file:border-[var(--gold)] file:bg-[var(--bg-secondary)] file:px-3 file:py-2 file:text-[var(--gold)]" aria-describedby={id + "-hint"} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <p id={id + "-hint"} className="mt-2 text-xs text-[var(--text-secondary)]">{t.formats}</p>
    {busy && <p role="status" className="mt-2 text-sm">{t.uploading}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{error}</p>}
    <details className="mt-4"><summary className="cursor-pointer py-2 text-sm text-[var(--gold)]">{t.useLink}</summary><label className="mt-2 block text-sm">{t.url}<input type="url" className="input-field mt-2" disabled={disabled || busy} value={value.startsWith("https://") ? value : ""} placeholder="https://…" onChange={(event) => { setError(""); onChange(event.target.value); }} /></label></details>
  </section>;
}
