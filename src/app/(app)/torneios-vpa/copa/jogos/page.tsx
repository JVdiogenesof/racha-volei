import Link from "next/link";
import { ArrowLeft, Crown, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { getFeaturedCup } from "@/lib/copaVpa";
import { cupChampion, loadCupDay, type CupMatch, type CupTeam } from "@/lib/copaDay";
import { computeStandings, matchWinner, teamIdentity } from "@/lib/copaDraw";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { CopaTeamLogo } from "@/components/CopaTeamLogo";
import { CopaAutoRefresh } from "@/components/CopaAutoRefresh";
import { saveScore } from "../sorteio/actions";

const STAGE_LABEL = { group: "Fase de grupos", bronze: "Disputa de 3º lugar", final: "Final" } as const;

function hour(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h")
    : "";
}

function TeamName({ team, align = "left", size = 28 }: { team: CupTeam | undefined; align?: "left" | "right"; size?: number }) {
  if (!team) return <span />;
  return (
    <span className={`flex min-w-0 items-center gap-2 font-bold ${align === "right" ? "flex-row-reverse text-right" : ""}`} style={{ color: teamIdentity(team.slug).accent }}>
      <CopaTeamLogo slug={team.slug} size={size} className="shrink-0" />
      <span className="truncate text-sm">{team.name}</span>
    </span>
  );
}

export default async function CopaJogosPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const cup = await getFeaturedCup(supabase, await getActiveCommunity());
  if (!cup) return <p className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">Nenhuma copa marcada por enquanto.</p>;

  const { teams, members, matches } = await loadCupDay(supabase, cup.id);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const revealed = members.filter((member) => member.revealed_at);
  const champion = cupChampion(teams, matches);
  const groups = matches.filter((match) => match.stage === "group");
  const standings = computeStandings(
    teams.map((team) => team.id),
    groups.map((match) => ({ teamA: match.team_a_id, teamB: match.team_b_id, scoreA: match.score_a, scoreB: match.score_b })),
  );
  const nextMatch = matches.find((match) => match.score_a == null || match.score_b == null);
  const rounds = [...new Set(matches.map((match) => `${match.stage}-${match.round}`))];

  return (
    <div className="space-y-5">
      <CopaAutoRefresh />
      <Link href="/torneios-vpa/copa" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Copa VPA
      </Link>

      {champion && (
        <section className="rounded-3xl border border-amber-300/40 bg-gradient-to-b from-[#4b2aa8] to-[#160b3a] p-6 text-center">
          <Trophy className="mx-auto h-9 w-9 text-amber-300" />
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">Campeão da {cup.name}</p>
          <div className="mt-3 flex justify-center"><CopaTeamLogo slug={champion.slug} size={110} /></div>
          <h1 className="mt-2 text-3xl font-black text-white">{champion.name}</h1>
          <ul className="mt-3 flex flex-wrap justify-center gap-3">
            {revealed.filter((member) => member.team_id === champion.id).map((member) => (
              <li key={member.profile_id} className="flex w-16 flex-col items-center gap-1 text-[11px] font-semibold text-white">
                <Avatar src={member.player?.avatar_url} name={member.player?.full_name ?? "?"} size="lg" frame={member.player?.avatar_frame} />
                {member.player?.full_name.split(" ")[0]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!matches.length ? (
        <section className="rounded-2xl border border-white/10 p-6 text-center text-sm text-white/60">
          Os confrontos aparecem aqui assim que o sorteio dos times terminar.
          <Link href="/torneios-vpa/copa/sorteio" className="mt-3 block font-bold text-purple-300 hover:underline">Ir para o sorteio</Link>
        </section>
      ) : (
        <>
          {nextMatch && (
            <section className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-rose-200">Próximo jogo · {hour(nextMatch.scheduled_at)}</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <TeamName team={teamById.get(nextMatch.team_a_id)} size={40} />
                <span className="text-xs text-white/50">x</span>
                <TeamName team={teamById.get(nextMatch.team_b_id)} align="right" size={40} />
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Jogos</h2>
            {rounds.map((key) => {
              const list = matches.filter((match) => `${match.stage}-${match.round}` === key);
              const first = list[0];
              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                    {first.stage === "group" ? `Rodada ${first.round}` : STAGE_LABEL[first.stage]}
                  </p>
                  <ul className="mt-1 divide-y divide-white/5">
                    {list.map((match) => (
                      <MatchRow key={match.id} match={match} teamById={teamById} cupId={cup.id} canEdit={profile.is_organizer} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">Classificação da fase de grupos</h2>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-[11px] uppercase tracking-wider text-white/45">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th><th className="px-2">J</th><th className="px-2">V</th><th className="px-2">D</th><th className="px-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, index) => (
                    <tr key={row.teamId} className="border-t border-white/5 text-center">
                      <td className="px-3 py-2 text-left"><span className="mr-2 text-white/40">{index + 1}º</span><span className="inline-flex align-middle"><TeamName team={teamById.get(row.teamId)} size={24} /></span></td>
                      <td>{row.played}</td><td className="font-bold">{row.wins}</td><td>{row.losses}</td><td>{row.balance > 0 ? `+${row.balance}` : row.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-white/45">Critério: vitórias, saldo de pontos, pontos pró e confronto direto. Os dois primeiros jogam a final; o 3º e o 4º, a disputa de bronze.</p>
          </section>
        </>
      )}

      {teams.length > 0 && revealed.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-white"><Crown className="h-4 w-4 text-pink-300" /> Os times</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => {
              const identity = teamIdentity(team.slug);
              return (
                <article key={team.id} className="rounded-2xl border p-3" style={{ borderColor: `${identity.color}66`, background: `${identity.color}14` }}>
                  <div className="flex items-center gap-3">
                    <CopaTeamLogo slug={team.slug} size={64} />
                    <h3 className="text-lg font-black" style={{ color: identity.accent }}>{team.name}</h3>
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {revealed.filter((member) => member.team_id === team.id).map((member) => (
                      <li key={member.profile_id} className="flex min-w-0 items-center gap-2 text-xs font-semibold text-white">
                        <Avatar src={member.player?.avatar_url} name={member.player?.full_name ?? "?"} size="sm" frame={member.player?.avatar_frame} still />
                        <span className="truncate">{member.player?.full_name}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchRow({ match, teamById, cupId, canEdit }: { match: CupMatch; teamById: Map<string, CupTeam>; cupId: string; canEdit: boolean }) {
  const winner = matchWinner(match);
  const played = match.score_a != null && match.score_b != null;
  const score = (value: number | null, id: string) => (
    <span className={`min-w-6 text-center text-xl font-black tabular-nums ${winner === id ? "text-white" : "text-white/55"}`}>{value ?? "–"}</span>
  );
  return (
    <li className="py-2.5">
      <div className="grid grid-cols-[44px_1fr_auto_1fr] items-center gap-2">
        <time className="text-xs tabular-nums text-white/45">{hour(match.scheduled_at)}</time>
        <TeamName team={teamById.get(match.team_a_id)} />
        <span className="flex items-center gap-2">{score(match.score_a, match.team_a_id)}<span className="text-xs text-white/35">x</span>{score(match.score_b, match.team_b_id)}</span>
        <TeamName team={teamById.get(match.team_b_id)} align="right" />
      </div>
      {canEdit && (
        <ActionForm action={saveScore} successMessage="Placar salvo." className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <input type="hidden" name="cupId" value={cupId} />
          <input type="hidden" name="matchId" value={match.id} />
          <input aria-label="Pontos do time da esquerda" name="scoreA" type="number" min={0} max={99} required defaultValue={match.score_a ?? ""} className="h-10 w-16 rounded-lg border border-white/15 bg-white/[0.04] px-2 text-center text-white" />
          <span className="text-white/40">x</span>
          <input aria-label="Pontos do time da direita" name="scoreB" type="number" min={0} max={99} required defaultValue={match.score_b ?? ""} className="h-10 w-16 rounded-lg border border-white/15 bg-white/[0.04] px-2 text-center text-white" />
          <button type="submit" className="min-h-10 rounded-lg bg-brand-purple px-3 text-xs font-bold text-white hover:bg-brand-purple-dark">{played ? "Corrigir" : "Salvar placar"}</button>
        </ActionForm>
      )}
    </li>
  );
}
