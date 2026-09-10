export function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="font-medium text-white">{value.toFixed(1)}</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-brand-purple"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
