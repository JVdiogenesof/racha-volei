import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { Avatar } from "./Avatar";

export function RecentTournamentChampionCard({
  eventDateLabel,
  teamNumber,
  players,
}: {
  eventDateLabel: string;
  teamNumber: number;
  players: { fullName: string; avatarUrl: string | null }[];
}) {
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-transparent p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
          <Trophy className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-white">Time {teamNumber} é campeão do Pré-Torneio! 🏆</h2>
          <p className="text-xs text-white/50">Racha de {eventDateLabel} — vagas garantidas no Torneio VPA</p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-3">
        {players.map((p) => (
          <li key={p.fullName} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <Avatar src={p.avatarUrl} name={p.fullName} size="sm" />
            <span className="text-sm text-white">{p.fullName}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/torneios-vpa"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:underline"
      >
        Ver Torneios VPA
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </section>
  );
}
