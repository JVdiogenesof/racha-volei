export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Carregando tela">
      <div className="h-7 w-44 rounded-lg bg-white/10" />
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="h-4 w-2/5 rounded bg-white/10" />
        <div className="mt-4 h-20 rounded-xl bg-white/[0.07]" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="h-16 rounded-xl bg-white/[0.06]" />
          <div className="h-16 rounded-xl bg-white/[0.06]" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 rounded-2xl bg-white/[0.05]" />
        <div className="h-28 rounded-2xl bg-white/[0.05]" />
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
