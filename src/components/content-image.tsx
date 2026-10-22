import Image from "next/image";

export function ContentImage({
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, 33vw",
  preload = false,
  className = "",
  onError,
}: {
  src: string;
  alt: string;
  sizes?: string;
  preload?: boolean;
  className?: string;
  onError?: () => void;
}) {
  const host = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "";
  const optimized =
    src.startsWith("/images/") ||
    (host && src.startsWith(`https://${host}/storage/v1/object/public/media/`));
  return (
    <Image
      src={src || "/images/stock/library.jpg"}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      unoptimized={!optimized}
      onError={onError}
      className={`object-cover ${className}`}
    />
  );
}
