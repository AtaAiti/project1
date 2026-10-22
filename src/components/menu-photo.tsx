"use client";

import { useState } from "react";
import { ContentImage } from "@/components/content-image";
import { categoryImage } from "@/lib/menu-presentation";
import { getDictionary } from "@/lib/dictionaries";

export function MenuPhoto({ src, category, alt, locale, sizes }: { src: string; category: string; alt: string; locale: string; sizes?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = failed === src ? categoryImage(category) : src;
  return <>
    <ContentImage src={source} alt={alt} sizes={sizes} onError={() => setFailed(src)} />
    {source.startsWith("/images/stock/") && <span className="absolute bottom-2 left-2 right-2 w-fit rounded bg-[var(--bg-primary)]/95 px-2 py-1 text-xs text-[var(--text-primary)]">{getDictionary(locale).menuPhotos.illustration}</span>}
  </>;
}
