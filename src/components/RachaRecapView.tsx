import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, Crown, Medal, Share2, Swords, Trophy, Users } from "lucide-react";
import type { RachaRecap, RecapMatch, RecapMove, RecapTeam } from "@/lib/rachaRecap";
import { teamBrandFor } from "@/lib/teamLogos";
import { Avatar } from "@/components/Avatar";
import { NeonCard } from "@/components/NeonCard";
import { ShareRachaSummaryButton } from "@/components/ShareRachaSummaryButton";
import { ShareFinalResultArtButton } from "@/components/ShareFinalResultArtButton";
import { ShareMvpArtButton } from "@/components/ShareMvpArtButton";

/**
 * "Como foi o racha": junta o que antes ficava em três telas (Resultado,
 * Resumo e Jogador Destaque) — campeão, destaque, pódio, todos os placares,
 * a campanha de cada time e quem mais subiu e caiu no Índice.
 */

const STAGE_LABEL: Record<RecapMatch["stage"], string> = { group: "Fase de grupos", third_place: "Disputa de 3º lugar", final: "Final", match: "" };
const PLACE_LABEL = ["Campeão", "Vice", "3º lugar", "4º lugar"];

function TeamLogo({ name, size = 40 }: { name: string; size?: number }) {
  const brand = teamBrandFor(name);
  if (!brand) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-white" style={{ width: size, height: size }}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logoWeb} alt="" height={size} style={{ height: size, width: "auto", filter: `drop-shadow(0 4px 10px ${brand.glow})` }} className="shrink-0" decoding="async" />
  );
}

function teamColor(name: string) {
  return teamBrandFor(name)?.accent ?? "#c4b5fd";
}

function record(team: RecapTeam) {
  const balance = team.pointsFor - team.pointsAgainst;
  const hasPoints = team.pointsFor + team.pointsAgainst > 0;
  return `${team.wins}V ${team.losses}D${hasPoints ? ` · saldo ${balance > 0 ? "+" : ""}${balance}` : ""}`;
}

export function RachaRecapView({ recap, isOrganizer }: { recap: RachaRecap; isOrganizer: boolean }) {
  const id = recap.event.id;
  const { event } = recap;
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const kind = event.isPreTournament ? "Pré-torneio" : event.isMiniTournament ? "Mini torneio" : "Racha";
  const teamById = new Map(recap.teams.map((team) => [team.id, team]));
  const finished = event.status === "finished";
  const champion = recap.champions[0] ?? null;
  const scoredFinal = recap.finalMatch && recap.finalMatch.scoreA != null && recap.finalMatch.scoreB != null ? recap.finalMatch : null;

  return (
    <div className="space-y-4">
      <Link href={`/racha/${id}`} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Voltar para o racha
      </Link>

      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-purple-300">
          {kind} · {dateLabel}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <h1 className="mt-0.5 text-2xl font-black text-white sm:text-3xl">Como foi o racha</h1>
        {recap.teams.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-white/70">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1"><Users className="h-3.5 w-3.5" /> {recap.playerCount} jogadores</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1"><Swords className="h-3.5 w-3.5" /> {recap.matches.length} {recap.matches.length === 1 ? "jogo" : "jogos"}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1"><CalendarDays className="h-3.5 w-3.5" /> {recap.teams.length} times</span>
          </div>
        )}
      </header>

      {!finished && (
        <NeonCard solid innerClassName="p-4 text-sm text-white/75">
          O racha ainda não foi encerrado. Os placares aparecem aqui conforme forem lançados, e o campeão e o destaque saem no fim.
        </NeonCard>
      )}

      {/* Campeão */}
      {champion && (
        <NeonCard theme="gold" innerClassName="p-4">
          <div className="relative z-10">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
              <Crown className="h-4 w-4" /> {recap.isTournament ? "Campeão" : recap.champions.length > 1 ? "Mais venceram (empate)" : "Time que mais venceu"}
            </p>
            {recap.champions.map((team) => (
              <div key={team.id} className="mt-3">
                <div className="flex items-center gap-3">
                  <TeamLogo name={team.name} size={64} />
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-white">{team.name}</h2>
                    <p className="text-xs font-semibold text-white/75">
                      {scoredFinal && recap.isTournament
                        ? `Final: ${scoredFinal.winnerId === scoredFinal.teamAId ? `${scoredFinal.scoreA} x ${scoredFinal.scoreB}` : `${scoredFinal.scoreB} x ${scoredFinal.scoreA}`} no ${teamById.get(scoredFinal.winnerId === scoredFinal.teamAId ? scoredFinal.teamBId : scoredFinal.teamAId)?.name ?? ""}`
                        : record(team)}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {team.members.map((member) => (
                    <li key={member.profileId} className="flex min-w-0 flex-col items-center gap-1 pt-3 text-center">
                      <Avatar src={member.avatarUrl} name={member.fullName} size="lg" frame={member.avatarFrame} still />
                      <span className="mt-1 w-full truncate text-[11px] font-bold text-white">{member.fullName.split(" ")[0]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </NeonCard>
      )}

      {/* Jogador Destaque (escolhido pelos organizadores) */}
      {finished && (
        <NeonCard solid innerClassName="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-black text-white">
              <Trophy className="h-4 w-4 text-amber-300" /> {recap.mvps.length > 1 ? "Jogadores Destaque" : "Jogador Destaque"}
            </p>
            {isOrganizer && (
              <Link href={`/racha/${id}/mvp`} className="text-xs font-bold text-purple-300 hover:underline">
                {recap.mvps.length ? "Alterar" : "Escolher"}
              </Link>
            )}
          </div>
          {recap.mvps.length ? (
            <ul className="mt-3 flex flex-wrap gap-4">
              {recap.mvps.map((mvp) => (
                <li key={mvp.profileId} className="flex items-center gap-3 pt-3">
                  <Avatar src={mvp.avatarUrl} name={mvp.fullName} size="lg" frame={mvp.avatarFrame} />
                  <span className="text-base font-black text-white">{mvp.fullName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-white/55">Os organizadores ainda vão escolher o destaque deste racha.</p>
          )}
        </NeonCard>
      )}

      {/* Pódio do mini torneio (do 2º ao 4º) */}
      {recap.placements.length > 1 && (
        <NeonCard solid innerClassName="p-4">
          <p className="flex items-center gap-1.5 text-sm font-black text-white"><Medal className="h-4 w-4 text-purple-200" /> Classificação final</p>
          <ol className="mt-3 space-y-2">
            {recap.placements.map(({ place, team }) => (
              <li key={team.id} className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${place === 1 ? "bg-amber-300 text-amber-950" : place === 2 ? "bg-slate-200 text-slate-900" : place === 3 ? "bg-orange-500 text-white" : "bg-white/15 text-white/80"}`}>{place}º</span>
                <TeamLogo name={team.name} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: teamColor(team.name) }}>{team.name}</span>
                <span className="shrink-0 text-[11px] font-semibold text-white/55">{PLACE_LABEL[place - 1]}</span>
              </li>
            ))}
          </ol>
        </NeonCard>
      )}

      {/* Todos os jogos */}
      {recap.matches.length > 0 && (
        <NeonCard solid innerClassName="p-4">
          <p className="flex items-center gap-1.5 text-sm font-black text-white"><Swords className="h-4 w-4 text-purple-200" /> Jogos do dia</p>
          <ol className="mt-3 space-y-1.5">
            {recap.matches.map((match, index) => {
              const a = teamById.get(match.teamAId);
              const b = teamById.get(match.teamBId);
              if (!a || !b) return null;
              const stage = STAGE_LABEL[match.stage];
              const showStage = stage && (index === 0 || recap.matches[index - 1].stage !== match.stage);
              const hasScore = match.scoreA != null && match.scoreB != null;
              return (
                <li key={match.id}>
                  {showStage && <p className="mb-1 mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200/80 first:mt-0">{stage}</p>}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-white/[0.05] px-2.5 py-2">
                    <span className={`flex min-w-0 items-center gap-1.5 ${match.winnerId === a.id ? "" : "opacity-60"}`}>
                      <TeamLogo name={a.name} size={26} />
                      <span className="truncate text-xs font-bold" style={{ color: teamColor(a.name) }}>{a.name}</span>
                    </span>
                    <span className="rounded-lg bg-black/30 px-2.5 py-1 text-center text-sm font-black tabular-nums text-white">
                      {hasScore ? `${match.scoreA} x ${match.scoreB}` : match.winnerId ? "venceu" : "—"}
                    </span>
                    <span className={`flex min-w-0 flex-row-reverse items-center gap-1.5 text-right ${match.winnerId === b.id ? "" : "opacity-60"}`}>
                      <TeamLogo name={b.name} size={26} />
                      <span className="truncate text-xs font-bold" style={{ color: teamColor(b.name) }}>{b.name}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </NeonCard>
      )}

      {/* Times e campanha */}
      {recap.teams.length > 0 && (
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-black text-white"><Users className="h-4 w-4 text-purple-200" /> Times</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...recap.teams]
              .sort((x, y) => y.wins - x.wins || y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst))
              .map((team) => (
                <NeonCard key={team.id} solid innerClassName="p-3">
                  <div className="flex items-center gap-2.5">
                    <TeamLogo name={team.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black" style={{ color: teamColor(team.name) }}>{team.name}</p>
                      <p className="text-[11px] font-semibold text-white/60">{team.played ? record(team) : "Sem jogos lançados"}</p>
                    </div>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                    {team.members.map((member) => (
                      <li key={member.profileId} className="flex items-center gap-1.5">
                        <Avatar src={member.avatarUrl} name={member.fullName} size="sm" />
                        <span className="text-xs text-white/85">{member.fullName.split(" ")[0]}</span>
                        {member.isSetter && <span className="rounded bg-white/15 px-1 text-[9px] font-black uppercase text-white/80">lev</span>}
                      </li>
                    ))}
                  </ul>
                </NeonCard>
              ))}
          </div>
        </section>
      )}

      {/* Índice VPA: só no racha mais recente */}
      {recap.moves && (
        <NeonCard solid innerClassName="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-white">Mexeu no Índice VPA</p>
            <Link href="/ranking" className="text-xs font-bold text-purple-300 hover:underline">Ver ranking</Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MoveList title="Mais subiram" rows={recap.moves.up} up />
            <MoveList title="Mais caíram" rows={recap.moves.down} />
          </div>
        </NeonCard>
      )}

      {/* Artes para compartilhar */}
      {finished && recap.teams.length > 0 && (
        <NeonCard solid innerClassName="space-y-3 p-4">
          <p className="flex items-center gap-1.5 text-sm font-black text-white"><Share2 className="h-4 w-4 text-purple-200" /> Compartilhar</p>
          <p className="text-xs text-white/55">Artes verticais prontas para o Instagram ou o grupo do WhatsApp.</p>
          <div className="space-y-3">
            <ShareBlock title="Resumo do dia">
              <ShareRachaSummaryButton eventId={id} eventDate={event.date} />
            </ShareBlock>
            {recap.isTournament && scoredFinal && (
              <ShareBlock title="Pódio">
                <ShareFinalResultArtButton eventId={id} eventDate={event.date} />
              </ShareBlock>
            )}
            {recap.mvps.length > 0 && (
              <ShareBlock title={recap.mvps.length > 1 ? "Jogadores Destaque" : "Jogador Destaque"}>
                <ShareMvpArtButton eventId={id} eventDate={event.date} />
              </ShareBlock>
            )}
          </div>
        </NeonCard>
      )}

      {!recap.teams.length && finished && (
        <NeonCard solid innerClassName="p-4 text-sm text-white/60">Este racha não teve times gerados no app, então não há placares para mostrar.</NeonCard>
      )}
    </div>
  );
}

function ShareBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/60">{title}</p>
      {children}
    </div>
  );
}

function MoveList({ title, rows, up = false }: { title: string; rows: RecapMove[]; up?: boolean }) {
  return (
    <div>
      <p className={`mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wide ${up ? "text-emerald-300" : "text-rose-300"}`}>
        {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />} {title}
      </p>
      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.profileId} className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-2.5 py-1.5">
              <Avatar src={row.avatarUrl} name={row.fullName} size="sm" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{row.fullName}</span>
              <span className="shrink-0 text-[11px] font-semibold text-white/60">{row.position}º</span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black ${up ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"}`}>
                {up ? "+" : "−"}{Math.abs(row.change)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-white/45">Ninguém.</p>
      )}
    </div>
  );
}
