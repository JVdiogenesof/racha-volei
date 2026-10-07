export default function AppLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando tela">
      <div className="skeleton-shimmer h-7 w-44 rounded-lg" />
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="skeleton-shimmer h-4 w-2/5 rounded" />
        <div className="skeleton-shimmer mt-4 h-20 rounded-xl" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="skeleton-shimmer h-16 rounded-xl" />
          <div className="skeleton-shimmer h-16 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="skeleton-shimmer h-28 rounded-2xl" />
        <div className="skeleton-shimmer h-28 rounded-2xl" />
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
