import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function EmptyState({ icon, title, description, actionHref, actionLabel, compact = false }: {
  icon: ReactNode;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  compact?: boolean;
}) {
  return <div className={`empty-state relative overflow-hidden rounded-2xl border border-dashed border-white/12 bg-white/[0.025] text-center ${compact ? "px-4 py-6" : "px-5 py-9"}`}>
    <span aria-hidden="true" className="absolute left-1/2 top-0 h-24 w-40 -translate-x-1/2 rounded-full bg-purple-400/10 blur-3xl" />
    <span className="empty-state-icon relative mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-purple-300/15 bg-purple-400/10 text-purple-200">{icon}</span>
    <h3 className="relative mt-3 font-black text-white/80">{title}</h3>
    <p className="relative mx-auto mt-1 max-w-sm text-xs leading-5 text-white/40">{description}</p>
    {actionHref && actionLabel && <Link href={actionHref} className="relative mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-purple-300/20 bg-purple-400/10 px-4 text-xs font-bold text-purple-100 hover:bg-purple-400/20">{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></Link>}
  </div>;
}
