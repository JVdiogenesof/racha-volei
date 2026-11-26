"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FlaskConical, Loader2, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { CopaTeamLogo } from "./CopaTeamLogo";
import { SetterBadge } from "./SetterBadge";
import { useToast } from "./Toast";
import { simulateDraw } from "@/app/(app)/torneios-vpa/copa/sorteio/actions";
import type { SimulatedDraw } from "@/lib/copaDay";
import { teamIdentity } from "@/lib/copaDraw";

/** Prévia do sorteio da Copa só para o organizador: não grava, não revela e ninguém mais vê. */
export function CopaSimularSorteioButton({ cupId }: { cupId: string }) {
  const [draw, setDraw] = useState<SimulatedDraw | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

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
      if (result.ok) setDraw(result.draw);
      else showToast(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-cyan-300/40 bg-cyan-400/10 px-3 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Simular sorteio
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
                    <FlaskConical className="h-4 w-4 text-cyan-300" /> Simulação do sorteio
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                    Prévia só sua: não grava nada e não aparece para ninguém. Baseada em{" "}
                    {draw.basis === "confirmed" ? "quem já confirmou" : `todos os ${draw.players} classificados (a confirmação ainda não fechou)`}
                    {draw.openSpots > 0 ? `; ${draw.openSpots} vaga${draw.openSpots === 1 ? "" : "s"} em aberto entra${draw.openSpots === 1 ? "" : "m"} com força média` : ""}.
                    O sorteio oficial pode sair diferente.
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

              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {draw.teams.map((team) => {
                  const identity = teamIdentity(team.slug);
                  return (
                    <div key={team.slug} className="rounded-xl border bg-white/[0.03] p-3" style={{ borderColor: `${identity.color}66` }}>
                      <div className="flex items-center gap-2.5">
                        <CopaTeamLogo slug={team.slug} size={34} />
                        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-white">{team.name}</h3>
                        <span className="text-xs text-white/40">força {team.strength.toFixed(0)}</span>
                      </div>
                      <ul className="mt-2.5 space-y-1.5">
                        {[...team.members]
                          .sort((a, b) => a.pot - b.pot)
                          .map((member) => (
                            <li key={member.profileId} className="flex items-center gap-2 text-sm">
                              <Avatar src={member.avatarUrl} name={member.name} size="sm" />
                              <span className={`min-w-0 flex-1 truncate ${member.open ? "italic text-white/40" : "text-white"}`}>{member.name}</span>
                              {member.isSetter && <SetterBadge />}
                            </li>
                          ))}
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
