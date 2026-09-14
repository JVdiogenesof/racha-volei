import { TrendingUp, Trophy, Crown, CalendarCheck, ThumbsUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPersonalEvolution } from "@/lib/evolution";

const STATUS_INFO = {
  confirmed: { label: "Confirmado", icon: CalendarCheck, className: "text-green-300" },
  interested: { label: "Interesse marcado", icon: ThumbsUp, className: "text-purple-300" },
  declined: { label: "Não foi", icon: X, className: "text-white/40" },
};

export default async function EvolucaoPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const entries = await getPersonalEvolution(supabase, profile.id);

  const totalConfirmados = entries.filter((e) => e.status === "confirmed").length;
  const totalDestaques = entries.filter((e) => e.wasDestaque).length;
  const totalVitorias = entries.reduce((sum, e) => sum + e.teamWins, 0);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <TrendingUp className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Minha evolução
      </h1>
      <p className="mt-1 text-sm text-white/60">Seu histórico racha a racha.</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <CalendarCheck className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
          <p className="mt-2 text-xl font-bold text-white">{totalConfirmados}</p>
          <p className="text-xs text-white/60">Presenças</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <Trophy className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
          <p className="mt-2 text-xl font-bold text-white">{totalDestaques}</p>
          <p className="text-xs text-white/60">Vezes destaque</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <Crown className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
          <p className="mt-2 text-xl font-bold text-white">{totalVitorias}</p>
          <p className="text-xs text-white/60">Vitórias</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {!entries.length && (
          <p className="text-sm text-white/60">Você ainda não respondeu a nenhum racha.</p>
        )}
        {entries.map((e) => {
          const statusInfo = STATUS_INFO[e.status];
          return (
            <div
              key={e.eventId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {new Date(`${e.date}T00:00:00`).toLocaleDateString("pt-BR")}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${statusInfo.className}`}>
                  <statusInfo.icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {statusInfo.label}
                </p>
              </div>
              {e.wasDestaque && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                  <Trophy className="h-3.5 w-3.5" strokeWidth={2} />
                  Destaque
                </span>
              )}
              {e.teamWins > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-300">
                  <Crown className="h-3.5 w-3.5" strokeWidth={2} />
                  Time venceu{e.teamWins > 1 ? ` ${e.teamWins}x` : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
