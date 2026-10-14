"use client";
import { useParams } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";

export default function ContentError({ reset }: { reset: () => void }) {
  const params = useParams();
  const t = getDictionary(String(params.locale || "ru")).publicUi;
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="display text-3xl">{t.loadingError}</h1>
      <button className="btn-gold mt-8" onClick={reset}>
        {t.retry}
      </button>
    </main>
  );
}
