export function NicknameBadge({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full bg-brand-purple/20 px-2.5 py-0.5 text-xs font-medium text-purple-200 ${className ?? ""}`}
    >
      {text}
    </span>
  );
}
