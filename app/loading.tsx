export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex flex-col items-center gap-4" role="status">
        <span className="relative grid h-12 w-12 place-items-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-2xl border border-gold-lo/40"
            style={{ animationDuration: "1.6s" }}
          />
          <span className="relative h-3 w-3 rounded-full bg-gold" />
        </span>
        <span className="text-xs uppercase tracking-[0.16em] text-muted-2">Loading</span>
      </div>
    </main>
  );
}
