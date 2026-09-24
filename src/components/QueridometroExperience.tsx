"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Heart, History, Loader2, LockKeyhole, RotateCcw, Share2, Sparkles, Users, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";

type ReactionType = {
  key: string;
  emoji: string;
  label: string;
  description: string;
};

type Player = { id: string; fullName: string; avatarUrl: string | null };
type Result = ReactionType & { total: number };
type Highlight = ReactionType & { total: number; players: Player[] };
type Connection = { profile: Player; emoji: string; label: string };
type HistoryEntry = {
  weekStart: string;
  label: string;
  totalVotes: number;
  myTotal: number;
  myTop: Result | null;
  leaders: string[];
};

type Tab = "evaluate" | "mine" | "highlights" | "history";

const TABS: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: "evaluate", label: "Avaliar", icon: Heart },
  { id: "mine", label: "Meu resultado", icon: Users },
  { id: "highlights", label: "Destaques", icon: Sparkles },
  { id: "history", label: "Histórico", icon: History },
];

async function fetchResultArt(weekStart: string) {
  const response = await fetch(`/reacoes/imagem?week=${encodeURIComponent(weekStart)}`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte.");
  return response.blob();
}

function downloadBlob(blob: Blob, weekStart: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `queridometro-vpa-${weekStart}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function QueridometroExperience({
  weekStart,
  weekLabel,
  votingOpen,
  revealAvailable,
  eligibleToVote,
  players,
  reactionTypes,
  votes,
  myResults,
  highlights,
  connections,
  history,
  setReactionAction,
  clearReactionAction,
}: {
  weekStart: string;
  weekLabel: string;
  votingOpen: boolean;
  revealAvailable: boolean;
  eligibleToVote: boolean;
  players: Player[];
  reactionTypes: ReactionType[];
  votes: Record<string, string>;
  myResults: Result[];
  highlights: Highlight[];
  connections: Connection[];
  history: HistoryEntry[];
  setReactionAction: (formData: FormData) => Promise<void>;
  clearReactionAction: (formData: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("evaluate");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const typeByKey = new Map(reactionTypes.map((type) => [type.key, type]));
  const evaluatedCount = players.filter((player) => votes[player.id]).length;
  const totalReceived = myResults.reduce((sum, result) => sum + result.total, 0);
  const previousWeek = history[0] ?? null;
  const weeklyDifference = previousWeek ? totalReceived - previousWeek.myTotal : null;

  function chooseReaction(reactionKey: string) {
    if (!selectedPlayer) return;
    const formData = new FormData();
    formData.set("toProfileId", selectedPlayer.id);
    formData.set("reactionKey", reactionKey);
    startTransition(async () => {
      try {
        await setReactionAction(formData);
        showToast(`Emoji escolhido para ${selectedPlayer.fullName}. Você pode trocar até sábado.`);
        setSelectedPlayerId(null);
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível salvar.");
      }
    });
  }

  function clearReaction() {
    if (!selectedPlayer) return;
    const formData = new FormData();
    formData.set("toProfileId", selectedPlayer.id);
    startTransition(async () => {
      try {
        await clearReactionAction(formData);
        showToast("Escolha removida.");
        setSelectedPlayerId(null);
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível remover.");
      }
    });
  }

  async function shareResult() {
    setShareBusy(true);
    try {
      const blob = await fetchResultArt(weekStart);
      const file = new File([blob], `queridometro-vpa-${weekStart}.png`, { type: "image/png" });
      const shareData = { title: "Meu Queridômetro VPA", text: "Meu resultado no Queridômetro VPA da semana! 💜", files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) await navigator.share(shareData);
      else {
        downloadBlob(blob, weekStart);
        showToast("Arte baixada! Agora é só compartilhar.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast(error instanceof Error ? error.message : "Não foi possível gerar a arte.");
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-purple-300/20 bg-gradient-to-br from-[#5b25ad] via-[#32176b] to-[#180c38] p-5 shadow-xl shadow-purple-950/20 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-200">Queridômetro VPA 💜</p>
            <h1 className="mt-2 text-3xl font-black text-white">Como a galera marcou sua semana?</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">Escolhas anônimas, conexões verdadeiras e muita resenha dentro e fora da quadra.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-right">
            <p className="text-xs text-white/45">Semana</p>
            <p className="mt-0.5 text-sm font-bold text-white">{weekLabel}</p>
            <p className={`mt-1 text-xs font-semibold ${votingOpen ? "text-green-300" : "text-amber-300"}`}>
              {votingOpen ? "Votação aberta até sábado" : "Resultados liberados"}
            </p>
          </div>
        </div>
      </section>

      <nav aria-label="Seções do Queridômetro" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${tab === item.id ? "border-purple-300/35 bg-brand-purple text-white" : "border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/[0.07] hover:text-white"}`}>
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </nav>

      {tab === "evaluate" && (
        <section>
          {!votingOpen ? (
            <LockedMessage title="A votação desta semana encerrou" text="Hoje é dia de descobrir os resultados. A próxima rodada abre na segunda-feira." />
          ) : !eligibleToVote ? (
            <LockedMessage title="Participe de um racha para votar" text="O Queridômetro fica disponível para quem participou de pelo menos um racha nos últimos 30 dias." />
          ) : !players.length ? (
            <LockedMessage title="Ainda não há pessoas para avaliar" text="Os participantes recentes aparecerão aqui depois que um racha for encerrado." />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-bold text-white">Escolha um emoji para cada pessoa</h2>
                  <p className="mt-1 text-sm text-white/50">Ninguém verá quem enviou. Você pode mudar suas escolhas até sábado.</p>
                </div>
                <span className="rounded-full bg-purple-400/10 px-3 py-1 text-xs font-bold text-purple-200">{evaluatedCount}/{players.length} avaliados</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-purple-300 transition-all" style={{ width: `${players.length ? (evaluatedCount / players.length) * 100 : 0}%` }} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {players.map((player) => {
                  const choice = typeByKey.get(votes[player.id]);
                  return (
                    <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={`relative flex min-w-0 flex-col items-center rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 ${choice ? "border-purple-300/30 bg-brand-purple/10" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.06]"}`}>
                      {choice && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-300"><CheckCircle2 className="h-4 w-4" /></span>}
                      <Avatar src={player.avatarUrl} name={player.fullName} size="lg" />
                      <span className="mt-2 w-full truncate text-sm font-semibold text-white">{player.fullName}</span>
                      <span className={`mt-2 min-h-8 text-xs ${choice ? "text-purple-200" : "text-white/35"}`}>{choice ? `${choice.emoji} ${choice.label}` : "Escolher emoji"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "mine" && (
        <section>
          {!revealAvailable ? <LockedMessage title="Seu resultado chega no domingo" text="Durante a semana, as escolhas ficam em segredo. Volte no domingo para ver os emojis recebidos e suas conexões." /> : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-xl font-black text-white">Meu resultado</h2><p className="mt-1 text-sm text-white/50">Você recebeu {totalReceived} {totalReceived === 1 ? "reação" : "reações"} nesta semana.</p></div>
                {totalReceived > 0 && <button type="button" onClick={shareResult} disabled={shareBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white hover:bg-brand-purple-dark disabled:opacity-60">{shareBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Compartilhar resultado</button>}
              </div>
              {myResults.length ? <div className="grid gap-3 sm:grid-cols-2">{myResults.map((result, index) => <div key={result.key} className={`queridometro-reveal rounded-2xl border p-4 ${index === 0 ? "border-purple-300/30 bg-gradient-to-br from-brand-purple/20 to-transparent" : "border-white/10 bg-white/[0.035]"}`} style={{ animationDelay: `${index * 70}ms` }}><div className="flex items-center gap-3"><span className="text-4xl">{result.emoji}</span><div className="min-w-0 flex-1"><p className="font-bold text-white">{result.label}</p><p className="text-xs text-white/45">{result.description}</p></div><span className="text-2xl font-black text-purple-200">{result.total}</span></div></div>)}</div> : <EmptyResult />}
              {previousWeek && weeklyDifference !== null && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/45">Comparação com a semana anterior</p><div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2"><p className={`text-sm font-bold ${weeklyDifference > 0 ? "text-green-300" : weeklyDifference < 0 ? "text-amber-300" : "text-white/65"}`}>{weeklyDifference > 0 ? "+" : ""}{weeklyDifference} reações</p><p className="text-sm text-white/55">Anterior: {previousWeek.myTop ? `${previousWeek.myTop.emoji} ${previousWeek.myTop.label}` : "sem resultado"}</p></div></div>}
              {connections.length > 0 && <div className="rounded-2xl border border-pink-300/20 bg-pink-400/[0.07] p-4"><h3 className="font-bold text-white">Conexões mútuas</h3><p className="mt-1 text-xs text-white/45">Essas pessoas escolheram o mesmo sentimento que você.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{connections.map((connection) => <div key={`${connection.profile.id}-${connection.label}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><Avatar src={connection.profile.avatarUrl} name={connection.profile.fullName} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{connection.emoji} {connection.profile.fullName}</p><p className="text-xs text-pink-200">{connection.label}</p></div></div>)}</div></div>}
            </div>
          )}
        </section>
      )}

      {tab === "highlights" && (
        <section>
          {!revealAvailable ? <LockedMessage title="Os destaques serão revelados no domingo" text="Até lá, os totais ficam escondidos para não influenciar as escolhas da semana." /> : highlights.length ? <><h2 className="text-xl font-black text-white">Destaques da semana</h2><p className="mt-1 text-sm text-white/50">Quem mais recebeu cada carinho da galera.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{highlights.map((highlight) => <div key={highlight.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center gap-3"><span className="text-4xl">{highlight.emoji}</span><div><p className="font-bold text-white">{highlight.label}</p><p className="text-xs text-purple-200">{highlight.total} {highlight.total === 1 ? "voto" : "votos"}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{highlight.players.map((player) => <span key={player.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-xs font-semibold text-white"><Avatar src={player.avatarUrl} name={player.fullName} size="sm" />{player.fullName}</span>)}</div></div>)}</div></> : <EmptyResult />}
        </section>
      )}

      {tab === "history" && (
        <section>
          <h2 className="text-xl font-black text-white">Histórico semanal</h2>
          <p className="mt-1 text-sm text-white/50">Veja como seus resultados mudaram ao longo do tempo.</p>
          {history.length ? <div className="mt-4 space-y-3">{history.map((entry) => <div key={entry.weekStart} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-white">{entry.label}</p><p className="mt-0.5 text-xs text-white/40">{entry.totalVotes} escolhas no grupo</p></div>{entry.myTop ? <div className="text-right"><p className="font-bold text-purple-200">{entry.myTop.emoji} {entry.myTop.label}</p><p className="text-xs text-white/45">{entry.myTotal} recebidas por você</p></div> : <span className="text-xs text-white/35">Sem resultado pessoal</span>}</div>{entry.leaders.length > 0 && <p className="mt-3 border-t border-white/8 pt-3 text-xs text-white/50"><strong className="text-white/70">Mais lembrados:</strong> {entry.leaders.join(" · ")}</p>}</div>)}</div> : <div className="mt-4"><EmptyResult text="O histórico começa depois da primeira revelação de domingo." /></div>}
        </section>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="queridometro-picker-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) setSelectedPlayerId(null); }}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[#1a0d38] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center gap-3"><Avatar src={selectedPlayer.avatarUrl} name={selectedPlayer.fullName} size="lg" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-purple-300">Escolha anônima</p><h2 id="queridometro-picker-title" className="truncate text-xl font-black text-white">{selectedPlayer.fullName}</h2></div><button type="button" onClick={() => setSelectedPlayerId(null)} disabled={isPending} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">{reactionTypes.map((reaction) => { const selected = votes[selectedPlayer.id] === reaction.key; return <button key={reaction.key} type="button" disabled={isPending} onClick={() => chooseReaction(reaction.key)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${selected ? "border-purple-300/40 bg-brand-purple/20" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"}`}><span className="text-3xl">{reaction.emoji}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{reaction.label}</span><span className="mt-0.5 block text-xs text-white/45">{reaction.description}</span></span>{selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-300" />}</button>; })}</div>
            {votes[selectedPlayer.id] && <button type="button" disabled={isPending} onClick={clearReaction} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/45 hover:text-white"><RotateCcw className="h-4 w-4" /> Limpar minha escolha</button>}
            {isPending && <p className="mt-3 flex items-center gap-2 text-sm text-purple-200"><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function LockedMessage({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-400/10 text-purple-200"><LockKeyhole className="h-5 w-5" /></span><h2 className="mt-4 font-bold text-white">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-white/50">{text}</p></div>;
}

function EmptyResult({ text = "Ainda não houve escolhas suficientes nesta semana." }: { text?: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">{text}</div>;
}
