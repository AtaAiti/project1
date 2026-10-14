export function LoadingCards({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((key) => (
          <div key={key} className="skeleton h-48" />
        ))}
      </div>
    </div>
  );
}
