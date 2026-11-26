"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, FlaskConical, Loader2, Pencil, Save, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { CopaTeamLogo } from "./CopaTeamLogo";
import { SetterBadge } from "./SetterBadge";
import { useToast } from "./Toast";
import { loadSavedPlan, saveDrawPlan, simulateDraw } from "@/app/(app)/torneios-vpa/copa/sorteio/actions";
import type { SimulatedDraw } from "@/lib/copaDay";
import { teamIdentity } from "@/lib/copaDraw";

type Member = SimulatedDraw["teams"][number]["members"][number];

/**
 * Montagem dos times da Copa só para organizadores: simula com o algoritmo de
 * equilíbrio, deixa trocar jogadores entre os times (tocando em um e depois no
 * outro) e salva os times para a revelação ao vivo. Antes de salvar, nada é
 * gravado e ninguém mais vê.
 */
export function CopaSimularSorteioButton({ cupId, onSaved, hasPlan = false }: { cupId: string; onSaved?: () => void; hasPlan?: boolean }) {
  const [draw, setDraw] = useState<SimulatedDraw | null>(null);
  const [editing, setEditing] = useState(false);
  const [loadingSaved, startLoadingSaved] = useTransition();
  const [selected, setSelected] = useState<{ team: number; profileId: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const { showToast } = useToast();

  function pick(team: number, member: Member) {
    if (!draw || member.open) return;
    if (!selected || selected.team === team) {
      setSelected(selected?.profileId === member.profileId ? null : { team, profileId: member.profileId });
      return;
    }
    const teams = draw.teams.map((t) => ({ ...t, members: [...t.members] }));
    const a = teams[selected.team]!;
    const b = teams[team]!;
    const ia = a.members.findIndex((m) => m.profileId === selected.profileId);
    const ib = b.members.findIndex((m) => m.profileId === member.profileId);
    if (ia < 0 || ib < 0) return;
    const moving = a.members[ia]!;
    a.members[ia] = b.members[ib]!;
    b.members[ib] = moving;
    for (const t of [a, b]) t.strength = t.members.reduce((sum, m) => sum + m.strength, 0);
    setDraw({ ...draw, teams });
    setSelected(null);
  }

  function save() {
    if (!draw) return;
    if (!window.confirm("Salvar estes times para a revelação ao vivo? Substitui times salvos antes.")) return;
    startSaving(async () => {
      const formData = new FormData();
      formData.set("cupId", cupId);
      formData.set("teams", JSON.stringify(draw.teams.map((team) => team.members.map((m) => m.profileId))));
      const result = await saveDrawPlan(formData);
      if (result.ok) {
        showToast(result.message);
        setDraw(null);
        onSaved?.();
      } else showToast(result.error);
    });
  }

  useEffect(() => {
    if (!draw) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDraw(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [draw]);

  function run() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("cupId", cupId);
      const result = await simulateDraw(formData);
      setSelected(null);
      setEditing(false);
      if (result.ok) setDraw(result.draw);
      else showToast(result.error);
    });
  }

  function openSaved() {
    startLoadingSaved(async () => {
      const formData = new FormData();
      formData.set("cupId", cupId);
      const result = await loadSavedPlan(formData);
      setSelected(null);
      if (result.ok) {
        setEditing(true);
        setDraw(result.draw);
      } else showToast(result.error);
    });
  }

  return (
    <>
      {hasPlan && (
        <button
          type="button"
          onClick={openSaved}
          disabled={loadingSaved}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 text-sm font-bold text-amber-100 hover:bg-amber-300/20 disabled:opacity-60"
        >
          {loadingSaved ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Editar times salvos
        </button>
      )}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-cyan-300/40 bg-cyan-400/10 px-3 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Simular e montar times
      </button>

      {draw &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setDraw(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="copa-sim-title"
              className="max-h-[88dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-white/15 bg-[#171122] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-5"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#171122]/95 pb-3 backdrop-blur-xl">
                <div className="min-w-0">
                  <h2 id="copa-sim-title" className="flex items-center gap-2 font-semibold text-white">
                    {editing ? <Pencil className="h-4 w-4 text-amber-300" /> : <FlaskConical className="h-4 w-4 text-cyan-300" />} {editing ? "Editar times salvos" : "Montar times"}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                    {editing ? "Estes são os times salvos (ainda escondidos). Nada muda até você salvar de novo." : (<>Prévia só sua: não grava nada e não aparece para ninguém. Baseada em{" "}
                    {draw.basis === "confirmed" ? "quem já confirmou" : `todos os ${draw.players} classificados (a confirmação ainda não fechou)`}
                    {draw.openSpots > 0 ? `; ${draw.openSpots} vaga${draw.openSpots === 1 ? "" : "s"} em aberto entra${draw.openSpots === 1 ? "" : "m"} com força média` : ""}.</>)}
                    {" "}Toque num jogador e depois em outro de outro time para trocar os dois. Quando gostar, salve: na live, o botão Iniciar revela estes times.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={run} disabled={pending} aria-label="Simular de novo" title="Simular de novo" className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-300/25 bg-purple-400/10 text-purple-200 hover:bg-purple-400/20 disabled:opacity-50">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => setDraw(null)} aria-label="Fechar simulação" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {(() => {
                const averages = draw.teams.map((team) => team.strength / Math.max(1, team.members.length));
                const gap = Math.max(...averages) - Math.min(...averages);
                const canSave = draw.basis === "confirmed" && draw.openSpots === 0;
                return (
                  <div className="mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <span className={`text-xs font-bold ${gap <= 0.15 ? "text-emerald-200" : gap <= 0.35 ? "text-amber-200" : "text-rose-200"}`}>
                      Diferença de nota média entre o time mais forte e o mais fraco: {gap.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={save}
                      disabled={!canSave || saving}
                      title={canSave ? "Salvar para a revelação" : "Só dá para salvar com todos os jogadores confirmados"}
                      className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-[#2a1760] disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Usar estes times
                    </button>
                    {!canSave && <p className="w-full text-[11px] text-amber-200/80">Salvar libera quando todos os jogadores do sorteio tiverem confirmado.</p>}
                  </div>
                );
              })()}

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {draw.teams.map((team, teamIndex) => {
                  const identity = teamIdentity(team.slug);
                  return (
                    <div key={team.slug} className="rounded-xl border bg-white/[0.03] p-3" style={{ borderColor: `${identity.color}66` }}>
                      <div className="flex items-center gap-2.5">
                        <CopaTeamLogo slug={team.slug} size={34} />
                        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-white">{team.name}</h3>
                        <span className="text-xs text-white/50">nota média {(team.strength / Math.max(1, team.members.length)).toFixed(2)}</span>
                      </div>
                      <ul className="mt-2.5 space-y-1.5">
                        {team.members.map((member) => {
                          const isSelected = selected?.profileId === member.profileId;
                          const swapTarget = Boolean(selected && selected.team !== teamIndex && !member.open);
                          return (
                            <li key={member.profileId}>
                              <button
                                type="button"
                                onClick={() => pick(teamIndex, member)}
                                disabled={member.open}
                                className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm transition ${isSelected ? "bg-amber-300/20 ring-1 ring-amber-300" : swapTarget ? "hover:bg-cyan-400/15" : "hover:bg-white/5"}`}
                              >
                                <Avatar src={member.avatarUrl} name={member.name} size="sm" />
                                <span className={`min-w-0 flex-1 truncate ${member.open ? "italic text-white/40" : "text-white"}`}>{member.name}</span>
                                {member.isSetter && <SetterBadge />}
                                {!member.open && <span className="w-9 text-right text-[11px] tabular-nums text-white/45">{member.strength.toFixed(2)}</span>}
                                {swapTarget && <ArrowLeftRight className="h-3.5 w-3.5 text-cyan-200" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
