"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Expand, Loader2, Minimize, Pause, Play, RotateCcw, SkipForward, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { teamIdentity } from "@/lib/copaDraw";
import { Avatar } from "./Avatar";
import { CopaTeamLogo } from "./CopaTeamLogo";
import { useToast } from "./Toast";
import { prepareDraw, resetDraw, revealNext } from "@/app/(app)/torneios-vpa/copa/sorteio/actions";

export type DrawTeam = { id: string; slug: string; name: string; position: number };
export type DrawMember = {
  profile_id: string;
  team_id: string;
  pot: number;
  pick_order: number;
  player: { full_name: string; avatar_url: string | null; avatar_frame: string | null; is_setter: boolean } | null;
};

const SELECT =
  "profile_id, team_id, pot, pick_order, player:profiles!cup_team_members_profile_id_fkey(full_name, avatar_url, avatar_frame, is_setter)";
const POLL_MS = 1500;
const AUTO_MS = 6500;
const REACTIONS = ["🔥", "👏", "😱", "🏐"];

const potLabel = (pot: number) => (pot === 0 ? "Levantadores" : `Pote ${pot}`);
const firstName = (name: string) => name.split(" ")[0];

export function CopaSorteioAoVivo({
  cupId,
  cupName,
  teams,
  teamSize,
  totalPicks,
  initialMembers,
  isOrganizer,
  hasPlan,
}: {
  cupId: string;
  cupName: string;
  teams: DrawTeam[];
  teamSize: number;
  /** Quantas escolhas o sorteio tem no total (só o organizador sabe antes de revelar). */
  totalPicks: number;
  initialMembers: DrawMember[];
  isOrganizer: boolean;
  hasPlan: boolean;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [placed, setPlaced] = useState<DrawMember[]>(initialMembers);
  const [spot, setSpot] = useState<{ member: DrawMember; phase: "rolling" | "shown" | "sending" } | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  const [plan, setPlan] = useState(hasPlan);
  const [floats, setFloats] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);

  const placedRef = useRef(placed);
  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);
  const queue = useRef<DrawMember[]>([]);
  const knownOrders = useRef(new Set(initialMembers.map((member) => member.pick_order)));
  const running = useRef(false);
  const reactionSeq = useRef(0);
  const total = totalPicks || teams.length * teamSize;
  const done = placed.length >= total && total > 0 && !spot;

  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const playQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const member = queue.current.shift()!;
      setSpot({ member, phase: "rolling" });
      await sleep(1100);
      setSpot({ member, phase: "shown" });
      await sleep(1700);
      setSpot({ member, phase: "sending" });
      setTarget(member.team_id);
      await sleep(1000);
      setPlaced((list) => [...list, member]);
      setSpot(null);
      setTarget(null);
      await sleep(350);
    }
    running.current = false;
    if (placedRef.current.length >= total) setConfettiKey((key) => key + 1);
  }, [total]);

  // Plateia: pergunta ao banco a cada 1,5 s o que já foi revelado.
  useEffect(() => {
    const supabase = createClient();
    let stopped = false;
    const tick = async () => {
      const { data } = await supabase
        .from("cup_team_members")
        .select(SELECT)
        .eq("cup_id", cupId)
        .not("revealed_at", "is", null)
        .order("pick_order");
      if (stopped || !data) return;
      const rows = data as unknown as DrawMember[];
      if (rows.length < knownOrders.current.size) {
        // Sorteio refeito: recomeça limpo.
        knownOrders.current = new Set(rows.map((row) => row.pick_order));
        queue.current = [];
        setPlaced(rows);
        return;
      }
      const fresh = rows.filter((row) => !knownOrders.current.has(row.pick_order));
      if (!fresh.length) return;
      fresh.forEach((row) => knownOrders.current.add(row.pick_order));
      queue.current.push(...fresh);
      void playQueue();
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [cupId, playQueue]);

  const runAction = useCallback(
    async (action: (formData: FormData) => Promise<string | void>) => {
      const formData = new FormData();
      formData.set("cupId", cupId);
      setBusy(true);
      try {
        return await action(formData);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
        setAuto(false);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [cupId, showToast],
  );

  const nextPick = useCallback(async () => {
    const result = await runAction(revealNext);
    if (result) {
      const parsed = JSON.parse(result) as { remaining: number; finished: boolean };
      if (parsed.remaining === 0) setAuto(false);
    }
  }, [runAction]);

  // O organizador revela uma escolha a cada AUTO_MS, o tempo da animação.
  useEffect(() => {
    if (!auto) return;
    const first = window.setTimeout(() => void nextPick(), 0);
    const id = window.setInterval(() => void nextPick(), AUTO_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [auto, nextPick]);

  function sendReaction(emoji: string) {
    reactionSeq.current += 1;
    const id = reactionSeq.current;
    setFloats((list) => [...list.slice(-12), { id, emoji, left: 8 + ((id * 37) % 84) }]);
    window.setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 2300);
  }

  const byTeam = (teamId: string) => placed.filter((member) => member.team_id === teamId).sort((a, b) => a.pick_order - b.pick_order);
  const spotTeam = spot ? teams.find((team) => team.id === spot.member.team_id) : null;
  const spotIdentity = spotTeam ? teamIdentity(spotTeam.slug) : null;
  const remaining = Math.max(0, total - placed.length);

  const frame = big ? "fixed inset-0 z-[90] overflow-auto bg-[#0c0722] p-3 sm:p-6" : "";

  return (
    <div className={frame}>
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#3b2a78] bg-[radial-gradient(120%_90%_at_50%_0%,#2a1760,#120a2e_70%)] text-white shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">{cupName}</p>
            <h2 className="text-xl font-black leading-tight">Sorteio dos times</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-black">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {done ? "ENCERRADO" : "AO VIVO"}
            </span>
            <button type="button" onClick={() => setBig((value) => !value)} aria-label={big ? "Sair da tela cheia" : "Modo telão"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              {big ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div className="relative flex min-h-[210px] items-center justify-center px-3 py-4">
          {spot && (
            <div aria-hidden className="copa-beam absolute h-72 w-72 rounded-full opacity-60" style={{ background: "conic-gradient(from 0deg, transparent, rgba(245,184,61,.28), transparent 40%)" }} />
          )}
          {spot ? (
            <div key={spot.member.pick_order} className="copa-pop relative flex w-full max-w-md items-center gap-4 rounded-3xl border border-[#6a4fd0] bg-gradient-to-br from-[#3a2285] to-[#241257] p-4 shadow-2xl shadow-black/50">
              <div className="relative shrink-0 rounded-full bg-[#241352] p-1.5">
                {spot.phase === "rolling" ? (
                  <span className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-white/10 text-4xl">🏐</span>
                ) : (
                  <Avatar src={spot.member.player?.avatar_url} name={spot.member.player?.full_name ?? "?"} size="xl" frame={spot.member.player?.avatar_frame} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-200">{potLabel(spot.member.pot)}{spot.member.player?.is_setter && spot.member.pot === 0 ? " · levantador(a)" : ""}</p>
                {spot.phase === "rolling" ? (
                  <p className="mt-1 text-2xl font-black text-white/70">Sorteando…</p>
                ) : (
                  <>
                    <p className="mt-1 break-words text-2xl font-black leading-tight sm:text-3xl">{spot.member.player?.full_name}</p>
                    {spot.phase === "sending" && spotTeam && spotIdentity && (
                      <p className="copa-pop mt-2 flex items-center gap-2 text-sm font-bold" style={{ color: spotIdentity.accent }}>
                        <CopaTeamLogo slug={spotTeam.slug} size={30} /> vai para o {spotTeam.name}!
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : done ? (
            <div className="copa-pop text-center">
              <p className="text-3xl font-black text-amber-200">Times definidos!</p>
              <p className="mt-1 text-sm text-white/70">Os confrontos já estão marcados.</p>
              <Link href="/torneios-vpa/copa/jogos" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-amber-300 px-4 text-sm font-black text-[#2a1760]">Ver jogos</Link>
            </div>
          ) : (
            <p className="max-w-sm text-center text-sm text-white/70">
              {plan || placed.length ? `Faltam ${remaining} jogadores. Cada time recebe um levantador primeiro e depois um jogador de cada pote, para ficarem equilibrados.` : "O sorteio ainda não foi preparado."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-3 lg:grid-cols-4">
          {teams.map((team) => {
            const identity = teamIdentity(team.slug);
            const members = byTeam(team.id);
            const isTarget = target === team.id;
            return (
              <article
                key={team.id}
                className="min-w-0 rounded-2xl border bg-white/[0.05] p-2.5 transition-shadow duration-300"
                style={{ borderColor: isTarget ? identity.color : "rgba(255,255,255,.1)", boxShadow: isTarget ? `0 0 0 3px ${identity.color}66, 0 0 30px ${identity.color}55` : undefined }}
              >
                <div className="flex items-center gap-2">
                  <CopaTeamLogo slug={team.slug} size={60} className="shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-black leading-tight sm:text-base" style={{ color: identity.accent }}>{team.name}</h3>
                    <p className="text-[11px] text-white/55">{members.length}/{teamSize}</p>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {Array.from({ length: teamSize }, (_, index) => {
                    const member = members[index];
                    return member ? (
                      <li key={member.profile_id} className="copa-pop flex items-center gap-1.5 rounded-lg px-1.5 py-1" style={{ background: `${identity.color}30`, border: `1px solid ${identity.color}80` }}>
                        <Avatar src={member.player?.avatar_url} name={member.player?.full_name ?? "?"} size="sm" frame={member.player?.avatar_frame} still />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{firstName(member.player?.full_name ?? "?")}</span>
                        {member.pot === 0 && <span className="rounded bg-white/15 px-1 text-[9px] font-black uppercase">lev</span>}
                      </li>
                    ) : (
                      <li key={`empty-${index}`} className="flex h-10 items-center rounded-lg border border-dashed border-white/15 px-2 text-[11px] text-white/35">
                        {index === 0 ? "levantador(a)" : `vaga ${index + 1}`}
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-3">
          {isOrganizer && (
            <>
              {!plan && !placed.length ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const message = await runAction(prepareDraw);
                    if (message) {
                      setPlan(true);
                      showToast(message);
                      router.refresh();
                    }
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-[#2a1760] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Preparar sorteio
                </button>
              ) : (
                <>
                  <button type="button" disabled={busy || remaining === 0} onClick={() => setAuto((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-[#2a1760] disabled:opacity-50">
                    {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {auto ? "Pausar" : placed.length ? "Continuar" : "Iniciar sorteio"}
                  </button>
                  <button type="button" disabled={busy || auto || remaining === 0} onClick={() => void nextPick()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-bold disabled:opacity-50">
                    <SkipForward className="h-4 w-4" /> Próximo
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm("Apagar o sorteio e os jogos para sortear de novo?")) return;
                      setAuto(false);
                      const message = await runAction(resetDraw);
                      if (message) {
                        queue.current = [];
                        knownOrders.current = new Set();
                        setPlaced([]);
                        setPlan(false);
                        showToast(message);
                        router.refresh();
                      }
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-bold text-white/80 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" /> Refazer
                  </button>
                </>
              )}
            </>
          )}
          <div className="ml-auto flex gap-1.5">
            {REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => sendReaction(emoji)} aria-label={`Reagir ${emoji}`} className="flex h-10 min-w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg hover:bg-white/15">
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {floats.map((item) => (
          <span key={item.id} aria-hidden className="copa-rise pointer-events-none absolute bottom-16 text-3xl" style={{ left: `${item.left}%` }}>{item.emoji}</span>
        ))}
        {confettiKey > 0 && (
          <div key={confettiKey} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
            {Array.from({ length: 48 }, (_, index) => (
              <span
                key={index}
                className="copa-confetti absolute top-0 h-2.5 w-1.5 rounded-sm"
                style={{
                  left: `${(index * 37) % 100}%`,
                  background: ["#8b5cf6", "#f5b83d", "#10b981", "#ef4444", "#fff"][index % 5],
                  animationDelay: `${(index % 8) * 0.12}s`,
                  ["--dx" as string]: `${((index * 53) % 120) - 60}px`,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
