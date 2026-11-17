"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Expand, Eye, Loader2, Minimize, Pause, Play, RotateCcw, SkipForward, Users, Wand2 } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { teamIdentity } from "@/lib/copaDraw";
import { Avatar } from "./Avatar";
import { CopaTeamLogo } from "./CopaTeamLogo";
import { useToast } from "./Toast";
import { prepareDraw, resetDraw, revealNext, type DrawActionResult } from "@/app/(app)/torneios-vpa/copa/sorteio/actions";

export type DrawTeam = { id: string; slug: string; name: string; position: number };
export type DrawMember = {
  profile_id: string;
  team_id: string;
  pot: number;
  pick_order: number;
  player: { full_name: string; avatar_url: string | null; avatar_frame: string | null; is_setter: boolean } | null;
};
/** Quem pode aparecer no sorteio (público: a lista de classificados já é aberta). */
export type PoolPlayer = { id: string; name: string; avatar: string | null; frame: string | null; isSetter: boolean };
export type DrawReadinessView = { needed: number; ready: number; qualified: number; usesConfirmation: boolean; setters: number };

const SELECT =
  "profile_id, team_id, pot, pick_order, player:profiles!cup_team_members_profile_id_fkey(full_name, avatar_url, avatar_frame, is_setter)";
const POLL_MS = 1500;
/** O organizador revela uma escolha a cada AUTO_MS: a animação inteira (4,7 s) e uma pausa pra respirar. */
const AUTO_MS = 6500;
const ROLL_MS = 1600;
const SHOW_MS = 1600;
const SEND_MS = 1200;
const REACTIONS = ["🔥", "👏", "😱", "🏐", "💜"];

const potLabel = (pot: number) => (pot === 0 ? "Levantadores" : `Pote ${pot}`);
const firstName = (name: string) => name.split(" ")[0];

export function CopaSorteioAoVivo({
  cupId,
  cupName,
  teams: initialTeams,
  teamSize,
  totalPicks,
  initialMembers,
  isOrganizer,
  hasPlan,
  pool,
  readiness,
}: {
  cupId: string;
  cupName: string;
  /** Times da copa; antes do sorteio ser preparado vêm só as identidades (id "preview-…"). */
  teams: DrawTeam[];
  teamSize: number;
  /** Quantas escolhas o sorteio tem no total. */
  totalPicks: number;
  initialMembers: DrawMember[];
  isOrganizer: boolean;
  hasPlan: boolean;
  pool: PoolPlayer[];
  /** Só o organizador: quantos já podem entrar no sorteio. */
  readiness: DrawReadinessView | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [teams, setTeams] = useState<DrawTeam[]>(initialTeams);
  const [placed, setPlaced] = useState<DrawMember[]>(initialMembers);
  const [spot, setSpot] = useState<{ member: DrawMember; phase: "rolling" | "shown" | "sending" } | null>(null);
  const [rollFace, setRollFace] = useState<PoolPlayer | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  const [plan, setPlan] = useState(hasPlan);
  const [floats, setFloats] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [viewers, setViewers] = useState<number | null>(null);
  // Telão em tela baixa (celular em pé ou deitado): destaque menor pra caber os 4 times sem rolar.
  const [short, setShort] = useState(false);
  const [wide, setWide] = useState(false);

  const placedRef = useRef(placed);
  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);
  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);
  const queue = useRef<DrawMember[]>([]);
  const knownOrders = useRef(new Set(initialMembers.map((member) => member.pick_order)));
  const running = useRef(false);
  const reactionSeq = useRef(0);
  const lastReactionAt = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tickRef = useRef<() => void>(() => {});
  const overlayRef = useRef<HTMLDivElement>(null);

  const total = totalPicks || teams.length * teamSize;
  const numTeams = Math.max(1, teams.length);
  const pots = Math.max(1, Math.ceil(total / numTeams));
  const done = placed.length >= total && total > 0 && !spot;
  const remaining = Math.max(0, total - placed.length);
  const currentPot = spot ? spot.member.pot : Math.min(pots - 1, Math.floor(placed.length / numTeams));
  const lastPick = placed.at(-1) ?? null;
  const lastPickTeam = lastPick ? teams.find((team) => team.id === lastPick.team_id) : null;

  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const playQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const member = queue.current.shift()!;
      setSpot({ member, phase: "rolling" });
      await sleep(ROLL_MS);
      setSpot({ member, phase: "shown" });
      await sleep(SHOW_MS);
      setSpot({ member, phase: "sending" });
      setTarget(member.team_id);
      await sleep(SEND_MS);
      setPlaced((list) => [...list, member]);
      setSpot(null);
      setTarget(null);
      await sleep(300);
    }
    running.current = false;
    if (placedRef.current.length >= total) setConfettiKey((key) => key + 1);
  }, [total]);

  // Plateia: pergunta ao banco o que já foi revelado. O aviso do organizador
  // (canal ao vivo) só adianta a pergunta; sem ele, o intervalo fixo garante.
  useEffect(() => {
    const supabase = createClient();
    let stopped = false;
    const tick = async () => {
      if (teamsRef.current.some((team) => team.id.startsWith("preview-"))) {
        const { data: realTeams } = await supabase.from("cup_teams").select("id, slug, name, position").eq("cup_id", cupId).order("position");
        if (stopped) return;
        if (realTeams?.length) {
          setTeams(realTeams as DrawTeam[]);
          setPlan(true);
        }
      }
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
    tickRef.current = () => void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [cupId, playQueue]);

  // Canal ao vivo: quantas pessoas assistindo, reações de todo mundo e o
  // "revelou agora" do organizador. Se o canal falhar, o sorteio segue igual.
  useEffect(() => {
    const supabase = createClient();
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
    const channel = supabase.channel(`copa-sorteio-${cupId}`, { config: { presence: { key }, broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const emoji = (payload as { emoji?: string } | null)?.emoji;
        if (emoji && REACTIONS.includes(emoji)) addFloat(emoji);
      })
      .on("broadcast", { event: "tick" }, () => tickRef.current())
      .on("presence", { event: "sync" }, () => setViewers(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [cupId]);

  // Roleta de rostos enquanto sorteia: passa pelos jogadores que ainda não saíram.
  const candidates = useMemo(() => {
    const out = new Set(placed.map((member) => member.profile_id));
    return pool.filter((player) => !out.has(player.id));
  }, [placed, pool]);
  useEffect(() => {
    if (spot?.phase !== "rolling") return;
    const faces = spot.member.pot === 0 ? candidates.filter((player) => player.isSetter) : candidates;
    const list = faces.length ? faces : candidates;
    if (!list.length) return;
    let index = Math.floor(Math.random() * list.length);
    const step = () => {
      index = (index + 1 + Math.floor(Math.random() * 3)) % list.length;
      setRollFace(list[index]);
    };
    const first = window.setTimeout(step, 0);
    const id = window.setInterval(step, 90);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [spot?.phase, spot?.member.pot, candidates]);

  const runAction = useCallback(
    async (action: (formData: FormData) => Promise<DrawActionResult>) => {
      const formData = new FormData();
      formData.set("cupId", cupId);
      setBusy(true);
      try {
        const result = await action(formData);
        if (!result.ok) {
          showToast(result.error);
          setAuto(false);
          return null;
        }
        return result;
      } catch {
        showToast("Não foi possível concluir a ação. Confira a internet e tente de novo.");
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
    if (!result) return;
    void channelRef.current?.send({ type: "broadcast", event: "tick", payload: {} });
    tickRef.current();
    if (result.remaining === 0) setAuto(false);
  }, [runAction]);

  useEffect(() => {
    if (!auto) return;
    const first = window.setTimeout(() => void nextPick(), 0);
    const id = window.setInterval(() => void nextPick(), AUTO_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [auto, nextPick]);

  function addFloat(emoji: string) {
    reactionSeq.current += 1;
    const id = reactionSeq.current;
    setFloats((list) => [...list.slice(-18), { id, emoji, left: 6 + ((id * 37) % 86) }]);
    window.setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 2300);
  }

  function sendReaction(emoji: string) {
    addFloat(emoji);
    const now = Date.now();
    if (now - lastReactionAt.current < 300) return;
    lastReactionAt.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "react", payload: { emoji } });
  }

  // Tela cheia de verdade: o telão sai da página (que tem animação de entrada e
  // prendia o "fixed" no tamanho do próprio bloco) e pede tela cheia ao aparelho.
  useEffect(() => {
    if (!big) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = overlayRef.current;
    if (element?.requestFullscreen && !document.fullscreenElement) element.requestFullscreen().catch(() => {});
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBig(false);
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) setBig(false);
    };
    const measure = () => {
      setShort(window.innerHeight < 900);
      setWide(window.innerWidth > window.innerHeight * 1.3);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [big]);

  const byTeam = (teamId: string) => placed.filter((member) => member.team_id === teamId).sort((a, b) => a.pick_order - b.pick_order);
  const spotTeam = spot ? teams.find((team) => team.id === spot.member.team_id) : null;
  const spotIdentity = spotTeam ? teamIdentity(spotTeam.slug) : null;
  const notReady = Boolean(readiness && readiness.ready !== readiness.needed);
  const compactStage = big && short;
  const heroSize = compactStage ? "xl" : "2xl";
  // Celular deitado: o destaque vai pro lado dos times, senão os times ficam fora da tela.
  const sideBySide = compactStage && wide;

  const stage = (
    <div className={`relative flex items-center justify-center px-3 ${sideBySide ? "w-[34%] shrink-0 py-2" : compactStage ? "min-h-[150px] py-2" : big ? "min-h-[34vh] py-3" : "min-h-[240px] py-4"}`}>
      {spot && (
        <div
          aria-hidden
          className="copa-beam absolute h-80 w-80 rounded-full opacity-70"
          style={{ background: `conic-gradient(from 0deg, transparent, ${spot.phase === "sending" && spotIdentity ? `${spotIdentity.color}66` : "rgba(245,184,61,.3)"}, transparent 40%)` }}
        />
      )}
      {spot ? (
        <div key={`${spot.member.pick_order}-${spot.phase === "sending" ? "s" : "p"}`} className="copa-pop relative flex w-full max-w-lg flex-col items-center text-center">
          <p className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
            {sideBySide ? `${spot.member.pick_order}/${total}` : `${potLabel(spot.member.pot)} · escolha ${spot.member.pick_order} de ${total}`}
          </p>
          {spot.phase === "sending" && spotTeam && spotIdentity ? (
            <div className="mt-3 flex items-center gap-3 sm:gap-5">
              <Avatar src={spot.member.player?.avatar_url} name={spot.member.player?.full_name ?? "?"} size="xl" frame={spot.member.player?.avatar_frame} still />
              <ArrowRight className="h-7 w-7 shrink-0 text-white/70" strokeWidth={2.5} />
              <span className="copa-pop" style={{ filter: `drop-shadow(0 0 24px ${spotIdentity.color})` }}>
                <CopaTeamLogo slug={spotTeam.slug} size={compactStage ? 84 : big ? 150 : 112} />
              </span>
            </div>
          ) : (
            <div className={`relative rounded-full bg-[#241352] p-1.5 shadow-2xl shadow-black/50 ${compactStage ? "mt-2" : "mt-4"}`}>
              {spot.phase === "rolling" ? (
                rollFace ? (
                  <span className="block opacity-80 blur-[1.5px]">
                    <Avatar src={rollFace.avatar} name={rollFace.name} size={heroSize} still />
                  </span>
                ) : (
                  <span className={`flex animate-pulse items-center justify-center rounded-full bg-white/10 ${compactStage ? "h-20 w-20 text-3xl" : "h-32 w-32 text-5xl"}`}>🏐</span>
                )
              ) : (
                <Avatar src={spot.member.player?.avatar_url} name={spot.member.player?.full_name ?? "?"} size={heroSize} frame={spot.member.player?.avatar_frame} />
              )}
            </div>
          )}
          {spot.phase === "rolling" ? (
            <p className={`font-black text-white/75 ${compactStage ? "mt-2 text-xl" : "mt-4 text-2xl"}`}>{rollFace ? firstName(rollFace.name) : "Sorteando"}…</p>
          ) : spot.phase === "shown" ? (
            <>
              <p className={`break-words font-black leading-tight ${compactStage ? "mt-2 text-2xl" : big ? "mt-4 text-4xl sm:text-5xl" : "mt-4 text-3xl"}`}>{spot.member.player?.full_name}</p>
              {spot.member.player?.is_setter && spot.member.pot === 0 && <p className="mt-1 text-xs font-bold uppercase tracking-wider text-purple-200">levantador(a)</p>}
            </>
          ) : spotTeam && spotIdentity ? (
            <p className={`font-black leading-tight ${compactStage ? "mt-2 text-xl" : big ? "mt-3 text-3xl sm:text-4xl" : "mt-3 text-2xl"}`}>
              {firstName(spot.member.player?.full_name ?? "")} vai para o <span style={{ color: spotIdentity.accent }}>{spotTeam.name}</span>!
            </p>
          ) : null}
        </div>
      ) : done ? (
        <div className="copa-pop text-center">
          <p className={`font-black text-amber-200 ${big ? "text-5xl" : "text-3xl"}`}>Times definidos!</p>
          <p className="mt-1 text-sm text-white/70">Os confrontos já estão marcados. Boa sorte a todos!</p>
          <Link href="/torneios-vpa/copa/jogos" className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-300 px-5 text-sm font-black text-[#2a1760]">
            Ver jogos e horários <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : plan || placed.length ? (
        <div className="text-center">
          <p className="text-2xl font-black">{placed.length ? "Já já sai o próximo…" : "Prontos?"}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-white/70">
            Faltam {remaining} jogadores. Cada time recebe primeiro um levantador e depois um jogador de cada pote, para ficarem equilibrados.
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-black">O sorteio começa em instantes</p>
          <p className="mt-1 text-sm text-white/70">
            {numTeams} times de {teamSize} · deixe esta tela aberta, os nomes aparecem sozinhos.
          </p>
          {pool.length > 0 && (
            <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
              {pool.slice(0, 32).map((player) => (
                <span key={player.id} title={player.name}>
                  <Avatar src={player.avatar} name={player.name} size="sm" still />
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const card = (
    <section
      className={`relative flex flex-col overflow-hidden border border-[#3b2a78] bg-[radial-gradient(120%_90%_at_50%_0%,#2a1760,#120a2e_70%)] text-white shadow-2xl ${
        big ? "h-full rounded-none sm:rounded-[1.75rem]" : "rounded-[1.75rem]"
      }`}
    >
      {/* Barra da transmissão */}
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">{cupName}</p>
          <h2 className={`font-black leading-tight ${big ? "text-2xl" : "text-xl"}`}>Sorteio dos times</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-black ${done ? "bg-white/15" : "bg-rose-600"}`}>
            {!done && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />} {done ? "ENCERRADO" : "AO VIVO"}
          </span>
          {viewers !== null && viewers > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/35 px-2 py-1 text-[11px] font-bold" aria-label={`${viewers} pessoas assistindo`}>
              <Eye className="h-3.5 w-3.5" /> {viewers}
            </span>
          )}
          <button type="button" onClick={() => setBig((value) => !value)} aria-label={big ? "Sair da tela cheia" : "Tela cheia"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            {big ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Progresso e potes */}
      {total > 0 && (plan || placed.length > 0) && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-white/70">
            <span>{placed.length} de {total} sorteados</span>
            {lastPick && lastPickTeam && !spot && (
              <span className="min-w-0 truncate">
                Último: <strong className="text-white">{firstName(lastPick.player?.full_name ?? "?")}</strong> → <span style={{ color: teamIdentity(lastPickTeam.slug).accent }}>{lastPickTeam.name}</span>
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400 transition-all duration-500" style={{ width: `${(placed.length / total) * 100}%` }} />
          </div>
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
            {Array.from({ length: pots }, (_, pot) => {
              const finished = placed.length >= (pot + 1) * numTeams;
              const active = !done && pot === currentPot;
              return (
                <span
                  key={pot}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                    active ? "bg-amber-300 text-[#2a1760]" : finished ? "bg-white/15 text-white/80" : "bg-white/5 text-white/40"
                  }`}
                >
                  {finished && !active && <Check className="h-3 w-3" strokeWidth={3} />} {potLabel(pot)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className={sideBySide ? "flex min-h-0 flex-1 items-stretch gap-1" : "contents"}>
      {stage}

      {/* Times */}
      <div className={`grid gap-2 px-3 pb-3 ${sideBySide ? "min-h-0 flex-1 content-center grid-cols-4 overflow-y-auto pt-2" : big ? "min-h-0 flex-1 content-start grid-cols-2 overflow-y-auto landscape:grid-cols-4 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
        {teams.map((team) => {
          const identity = teamIdentity(team.slug);
          const members = byTeam(team.id);
          const isTarget = target === team.id;
          return (
            <article
              key={team.id}
              className="min-w-0 rounded-2xl border p-2.5 transition-all duration-300"
              style={{
                borderColor: isTarget ? identity.color : "rgba(255,255,255,.1)",
                background: isTarget ? `${identity.color}26` : "rgba(255,255,255,.05)",
                boxShadow: isTarget ? `0 0 0 3px ${identity.color}66, 0 0 34px ${identity.color}66` : undefined,
                transform: isTarget ? "scale(1.02)" : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <CopaTeamLogo slug={team.slug} size={compactStage ? 44 : big ? 64 : 52} className="shrink-0" />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black leading-tight sm:text-base" style={{ color: identity.accent }}>{team.name}</h3>
                  <p className="flex items-center gap-1 text-[11px] text-white/55"><Users className="h-3 w-3" /> {members.length}/{teamSize}</p>
                </div>
              </div>
              {compactStage ? (
                // Telão no celular: fotos em grade (3 por linha) pra caber os 4 times inteiros na tela, sem rolar.
                <ul className="mt-2 grid grid-cols-3 gap-1">
                  {Array.from({ length: teamSize }, (_, index) => {
                    const member = members[index];
                    return member ? (
                      <li key={member.profile_id} className="copa-pop flex min-w-0 flex-col items-center rounded-lg px-0.5 pb-1 pt-1.5" style={{ background: `${identity.color}30`, border: `1px solid ${identity.color}80` }}>
                        <Avatar src={member.player?.avatar_url} name={member.player?.full_name ?? "?"} size="sm" still />
                        <span className="mt-0.5 w-full truncate text-center text-[10px] font-bold leading-tight">{firstName(member.player?.full_name ?? "?")}</span>
                      </li>
                    ) : (
                      <li key={`empty-${index}`} className="flex h-[3.4rem] items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] font-semibold text-white/30">
                        {index === 0 ? "lev" : index + 1}
                      </li>
                    );
                  })}
                </ul>
              ) : (
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
              )}
            </article>
          );
        })}
      </div>

      </div>

      {/* Reações e controles */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-3">
        {isOrganizer && (
          <>
            {!plan && !placed.length ? (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const result = await runAction(prepareDraw);
                    if (result) {
                      setPlan(true);
                      showToast(result.message);
                      router.refresh();
                    }
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-[#2a1760] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Preparar sorteio
                </button>
                {readiness && (
                  <span className={`text-xs font-semibold ${notReady ? "text-amber-200" : "text-emerald-200"}`}>
                    {readiness.ready}/{readiness.needed} {readiness.usesConfirmation ? "confirmados" : "classificados"} · {readiness.setters} levantadores
                  </span>
                )}
              </div>
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
                    const result = await runAction(resetDraw);
                    if (result) {
                      queue.current = [];
                      knownOrders.current = new Set();
                      setPlaced([]);
                      setPlan(false);
                      showToast(result.message);
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
            <button key={emoji} type="button" onClick={() => sendReaction(emoji)} aria-label={`Reagir ${emoji}`} className="flex h-10 min-w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg transition hover:bg-white/15 active:scale-90">
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {floats.map((item) => (
        <span key={item.id} aria-hidden className="copa-rise pointer-events-none absolute bottom-16 z-10 text-3xl" style={{ left: `${item.left}%` }}>{item.emoji}</span>
      ))}
      {confettiKey > 0 && (
        <div key={confettiKey} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
          {Array.from({ length: 56 }, (_, index) => (
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
  );

  if (big && typeof document !== "undefined") {
    return (
      <>
        <div className="flex min-h-40 items-center justify-center rounded-[1.75rem] border border-white/10 text-sm text-white/50">Sorteio aberto em tela cheia.</div>
        {createPortal(
          <div ref={overlayRef} className="fixed inset-0 z-[120] bg-[#0c0722] p-0 sm:p-4" style={{ paddingTop: "max(env(safe-area-inset-top), 0px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            {card}
          </div>,
          document.body,
        )}
      </>
    );
  }
  return card;
}
