import { notFound } from "next/navigation";
import { BarChart3, Crown, Trophy } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEventSummary } from "@/lib/eventSummary";
import { Avatar } from "@/components/Avatar";
import { ShareRachaSummaryButton } from "@/components/ShareRachaSummaryButton";

export default async function RachaSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const summary = await getEventSummary(await createClient(), id);
  if (!summary) notFound();

  const dateLabel = new Date(`${summary.event.date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const leaders = summary.players.filter(
    (player) => summary.bestWinCount > 0 && player.wins === summary.bestWinCount,
  );

  if (summary.event.status !== "finished") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-purple-300" />
        <h1 className="mt-3 text-xl font-bold">Resumo do racha</h1>
        <p className="mt-2 text-sm text-white/60">O resumo e a arte serão liberados quando o evento for encerrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Fim de jogo</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Resumo do racha</h1>
        <p className="mt-1 text-sm text-white/55">
          {dateLabel}{summary.event.location ? ` · ${summary.event.location}` : ""}
        </p>
      </div>

      {leaders.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/20 via-[#392751] to-[#171136] p-5">
          <span className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-300/10 blur-2xl" />
          <div className="relative flex items-center gap-2 text-amber-200">
            <Crown className="h-5 w-5" />
            <h2 className="font-bold">Quem mais venceu</h2>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-3">
            {leaders.map((player) => (
              <div key={player.profileId} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
                <Avatar src={player.avatarUrl} name={player.fullName} />
                <div className="min-w-0">
                  <p className="max-w-40 truncate font-semibold">{player.fullName}</p>
                  <p className="text-sm text-amber-200">
                    {player.wins} {player.wins === 1 ? "vitória" : "vitórias"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-300" />
            <h2 className="font-bold">Vitórias no racha</h2>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/55">
            {summary.totalMatches} {summary.totalMatches === 1 ? "jogo" : "jogos"}
          </span>
        </div>

        {summary.players.length ? (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {summary.players.map((player, index) => (
              <li key={player.profileId} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/10 p-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-amber-400/20 text-amber-200" : "bg-white/8 text-white/45"}`}>
                  {index + 1}
                </span>
                <Avatar src={player.avatarUrl} name={player.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{player.fullName}</p>
                  <p className="text-xs text-white/40">Time {player.teamNumber}</p>
                </div>
                <strong className="shrink-0 text-sm text-purple-200">
                  {player.wins} {player.wins === 1 ? "vitória" : "vitórias"}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 rounded-xl bg-black/10 p-4 text-sm text-white/50">Nenhum time foi gerado para este racha.</p>
        )}
      </section>

      {summary.players.length > 0 && (
        <section className="rounded-2xl border border-purple-300/15 bg-purple-400/8 p-4">
          <p className="mb-3 text-sm text-white/65">A arte vertical fica pronta para publicar no Instagram ou enviar no WhatsApp.</p>
          <ShareRachaSummaryButton eventId={id} eventDate={summary.event.date} />
        </section>
      )}
    </div>
  );
}
