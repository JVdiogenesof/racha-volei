import Link from "next/link";
import { Swords } from "lucide-react";
import { Avatar } from "./Avatar";

export function ReactionsReceivedCard({
  reactions,
}: {
  reactions: { fromName: string; fromAvatar: string | null; text: string }[];
}) {
  if (!reactions.length) return null;
  const latest = reactions[0];

  return (
    <Link
      href="/reacoes"
      className="flex items-center gap-3 rounded-2xl border border-brand-purple/40 bg-brand-purple/10 p-4 transition hover:bg-brand-purple/15"
    >
      <Avatar src={latest.fromAvatar} name={latest.fromName} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-300">
          <Swords className="h-3.5 w-3.5" strokeWidth={2} />
          Você recebeu uma reação!
        </p>
        <p className="mt-1 truncate text-sm text-white">
          <span className="font-medium">{latest.fromName}</span> {latest.text}
        </p>
        {reactions.length > 1 && (
          <p className="mt-0.5 text-xs text-white/40">
            +{reactions.length - 1} outra{reactions.length > 2 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
