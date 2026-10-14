"use client";

import { useEffect, useRef, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import { ContentImage } from "@/components/content-image";
import { isDemoRecord } from "@/lib/demo-content";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingCards } from "@/components/loading-cards";

type Row = Record<string, string | number | boolean | null> & { id: string };
type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "time"
    | "url"
    | "checkbox"
    | "select";
  required?: boolean;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
};
const d = getDictionary("ru");
const t = d.adminExtra;

export function ResourceEditor({
  resource,
  title,
  addLabel,
  fields,
  defaults,
  titleField,
  detailField,
  imageField,
  hint,
  search = false,
}: {
  resource: string;
  title: string;
  addLabel: string;
  fields: Field[];
  defaults: Omit<Row, "id">;
  titleField: string;
  detailField?: string;
  imageField?: string;
  hint?: string;
  search?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/${resource}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || d.errors["error.generic"]);
        setRows(result.data);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : d.errors["error.generic"],
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [resource]);
  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError("");
    const payload = Object.fromEntries(
      fields.map((field) => [field.key, editing[field.key]]),
    );
    if (editing.id) payload.id = editing.id;
    try {
      const response = await fetch(`/api/admin/${resource}`, {
        method: editing.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || d.errors["error.generic"]);
      setRows((current) =>
        editing.id
          ? current.map((row) => (row.id === editing.id ? result.data : row))
          : [result.data, ...current],
      );
      setEditing(null);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : d.errors["error.generic"],
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/${resource}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || d.errors["error.generic"]);
      setRows((current) => current.filter((row) => row.id !== id));
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : d.errors["error.generic"],
      );
    }
  }
  const shown = rows.filter((row) =>
    Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const statusLabel = (row: Row) =>
    row.status === "published"
      ? d.admin.published
      : row.status === "moderation"
        ? d.admin.moderation
        : d.admin.draft;
  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-6">
        <div>
          <h1 className="display text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {rows.length} · {t.liveData}
          </p>
        </div>
        <button
          className="btn-gold"
          disabled={loading}
          onClick={() => {
            setError("");
            setEditing({ ...defaults, id: "" } as Row);
          }}
        >
          {addLabel}
        </button>
      </header>
      <main className="p-6 md:p-8">
        {hint && (
          <p className="mb-6 text-sm text-[var(--text-secondary)]">{hint}</p>
        )}
        {error && !editing && (
          <p role="alert" className="mb-4 text-sm">
            {error}
          </p>
        )}
        {search && (
          <label className="mb-6 block text-sm">
            {t.filter}
            <input
              className="input-field mt-2 max-w-lg"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        {loading ? (
          <LoadingCards label={t.loading} />
        ) : !shown.length ? (
          <p className="card p-8">{t.empty}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {shown.map((row) => (
              <article key={row.id} className="card overflow-hidden">
                {imageField && row[imageField] && (
                  <div className="relative aspect-[16/9]">
                    <ContentImage
                      src={String(row[imageField])}
                      alt={String(row[titleField] || title)}
                      sizes="(max-width: 1280px) 100vw, 40vw"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="display text-2xl">
                    {String(row[titleField] || title)}
                  </h2>
                  {detailField && (
                    <p className="mt-3 whitespace-pre-line text-sm text-[var(--text-secondary)]">
                      {String(row[detailField] || "")}
                    </p>
                  )}
                  {resource === "menu_items" && (
                    <p className="mt-3 text-[var(--gold)]">
                      {row.price} {d.publicUi.currency} · {row.category}
                    </p>
                  )}
                  {resource === "events" && (
                    <p className="mt-3 text-sm">
                      {row.date} · {String(row.time).slice(0, 5)} · Asia/Bishkek
                    </p>
                  )}
                  {resource === "reviews" && (
                    <p
                      className="mt-3 text-[var(--gold)]"
                      aria-label={`${t.rating}: ${row.rating}/5`}
                    >
                      {"★".repeat(Number(row.rating))}
                    </p>
                  )}
                  {row.status && (
                    <p className="mt-3 text-sm">{statusLabel(row)}</p>
                  )}
                  {isDemoRecord(row.id) && (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {t.demoRecord}
                    </p>
                  )}
                  {resource === "events" && (
                    <Link
                      href={`/admin/events/${row.id}`}
                      className="mt-4 inline-block text-sm text-[var(--gold)]"
                    >
                      {d.rsvp.list}
                    </Link>
                  )}
                  <div className="mt-5 flex gap-5">
                    <button
                      className="text-sm text-[var(--gold)]"
                      onClick={() => {
                        setError("");
                        setEditing(row);
                      }}
                    >
                      {d.admin.edit}
                    </button>
                    <button className="text-sm" onClick={() => remove(row.id)}>
                      {d.admin.delete}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (saving) event.preventDefault();
          else setEditing(null);
        }}
        onClose={() => setEditing(null)}
        className="fixed max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto border border-[var(--border)] bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]"
      >
        {editing && (
          <form onSubmit={save}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="display text-2xl">
                {editing.id ? d.admin.editing : addLabel}
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
                aria-label={d.admin.close}
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4">
              {fields.map((field) => (
                <label key={field.key} className="block text-sm">
                  {field.label}
                  {field.type === "checkbox" ? (
                    <input
                      className="ml-4 h-5 w-5"
                      type="checkbox"
                      checked={Boolean(editing[field.key])}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [field.key]: event.target.checked,
                        })
                      }
                    />
                  ) : field.type === "select" ? (
                    <select
                      aria-label={field.label}
                      className="input-field mt-2"
                      value={String(editing[field.key] ?? "")}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [field.key]: event.target.value,
                        })
                      }
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      className="input-field mt-2"
                      rows={4}
                      maxLength={5000}
                      required={field.required}
                      value={String(editing[field.key] ?? "")}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [field.key]: event.target.value,
                        })
                      }
                    />
                  ) : (
                    <input
                      className="input-field mt-2"
                      type={field.type || "text"}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      step={
                        field.type === "number"
                          ? field.key === "price"
                            ? "0.01"
                            : "1"
                          : undefined
                      }
                      value={String(editing[field.key] ?? "")}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [field.key]:
                            field.type === "number"
                              ? field.key === "capacity" &&
                                event.target.value === ""
                                ? null
                                : Number(event.target.value)
                              : event.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-4">
              <button className="btn-gold" disabled={saving}>
                {saving ? t.saving : d.admin.save}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                {t.cancel}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
