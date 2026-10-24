"use client";
import { trapDialogTab } from "@/lib/dialog-focus";

import { useEffect, useId, useRef, useState } from "react";
import { ContentImage } from "@/components/content-image";
import { getDictionary } from "@/lib/dictionaries";
import type { GalleryPhoto } from "@/lib/content";

export function Gallery({
  photos,
  locale,
}: {
  photos: GalleryPhoto[];
  locale: string;
}) {
  const t = getDictionary(locale).publicUi;
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (selected !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (selected === null) return;
      if (event.key === "ArrowRight")
        setSelected((selected + 1) % photos.length);
      if (event.key === "ArrowLeft")
        setSelected((selected - 1 + photos.length) % photos.length);
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [selected, photos.length]);
  if (!photos.length) return <p className="card p-8">{t.emptyGallery}</p>;
  const caption = (photo: GalleryPhoto) =>
    (locale === "en" ? photo.caption_en : photo.caption_ru) || t.gallery;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo, index) => (
          <figure className="card overflow-hidden" key={photo.id}>
            <button
              type="button"
              className="relative block aspect-[4/3] w-full"
              onClick={() => setSelected(index)}
              aria-label={caption(photo)}
            >
              <ContentImage src={photo.image_url} alt={caption(photo)} />
            </button>
            <figcaption className="p-4 text-sm">{caption(photo)}</figcaption>
          </figure>
        ))}
      </div>
      <dialog
        onKeyDown={trapDialogTab}
        ref={dialog}
        aria-label={t.gallery}
        aria-describedby={id}
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        className="w-[calc(100%-2rem)] max-w-5xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-[var(--text-primary)]"
      >
        <button
          onClick={() => setSelected(null)}
          className="mb-3 float-right p-2"
          aria-label={t.closePhoto}
        >
          ✕
        </button>
        {selected !== null && (
          <>
            <div className="relative clear-both aspect-[4/3] max-h-[70vh]">
              <ContentImage
                src={photos[selected].image_url}
                alt={caption(photos[selected])}
                sizes="90vw"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                onClick={() =>
                  setSelected((selected - 1 + photos.length) % photos.length)
                }
                className="grid min-h-11 min-w-11 place-items-center"
                aria-label={t.previousPhoto}
              >
                ←
              </button>
              <p id={id} className="text-sm">
                {caption(photos[selected])}
              </p>
              <button
                onClick={() => setSelected((selected + 1) % photos.length)}
                className="grid min-h-11 min-w-11 place-items-center"
                aria-label={t.nextPhoto}
              >
                →
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
