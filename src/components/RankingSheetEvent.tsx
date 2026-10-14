"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus } from "lucide-react";
import { useToast } from "./Toast";
import type { SheetEvent } from "@/lib/rankingAdjust";

type Action = (formData: FormData) => Promise<void>;

const KIND_LABEL: Record<SheetEvent["kind"], string> = {
  racha: "Racha",
  pre_torneio: "Pré-torneio",
  mini_torneio: "Mini torneio",
};

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/** Card de um racha na ficha do jogador: presença, vitórias, derrotas e destaque. */
export function RankingSheetEvent({
  profileId,
  event,
  adjustResult,
  setFlag,
}: {
  profileId: string;
  event: SheetEvent;
  adjustResult: Action;
  setFlag: Action;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  // Valores mostrados na hora; o servidor confirma e a tela inteira se atualiza.
  const [view, setView] = useState(event.effective);
  const [prev, setPrev] = useState(event.effective);
  if (prev !== event.effective) {
    setPrev(event.effective);
    setView(event.effective);
  }
  const adjusted = event.adjust.attendance !== 0 || event.adjust.mvp !== 0 || event.adjust.wins !== 0 || event.adjust.losses !== 0;
  const isPre = event.kind === "pre_torneio";

  function run(action: Action, fields: Record<string, string>, optimistic: Partial<typeof view>) {
    const previous = view;
    setView({ ...view, ...optimistic });
    const formData = new FormData();
    formData.set("profileId", profileId);
    formData.set("eventId", event.id);
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      try {
        await action(formData);
        router.refresh();
        showToast("Ranking atualizado");
      } catch (error) {
        setView(previous);
        showToast(error instanceof Error ? error.message : "Não foi possível ajustar.");
      }
    });
  }

  function stepper(metric: "wins" | "losses", label: string) {
    const value = view[metric];
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.06] px-2 py-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-white/40">{label}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending || value <= 0}
            aria-label={`Diminuir ${label.toLowerCase()}`}
            onClick={() => run(adjustResult, { metric, delta: "-1" }, { [metric]: value - 1 })}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 text-center text-base font-extrabold tabular-nums text-white">{value}</span>
          <button
            type="button"
            disabled={isPending}
            aria-label={`Aumentar ${label.toLowerCase()}`}
            onClick={() => run(adjustResult, { metric, delta: "1" }, { [metric]: value + 1 })}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function toggle(metric: "attendance" | "mvp", label: string, on: boolean, key: "present" | "mvp") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/50">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={isPending}
          onClick={() => run(setFlag, { metric, value: String(!on) }, { [key]: !on })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-green-600" : "bg-white/15"}`}
        >
          <span className={`absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <article className={`grid gap-2.5 rounded-2xl border border-white/10 bg-white/[0.035] p-3 ${view.present ? "" : "opacity-85"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm font-extrabold text-white">{formatDay(event.date)}</b>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.kind === "racha" ? "bg-white/10 text-violet-100" : "bg-sky-300/15 text-sky-200"}`}>{KIND_LABEL[event.kind]}</span>
        {event.registered.legacyWins > 0 && (
          <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">formato antigo</span>
        )}
        {adjusted && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200">ajustado</span>}
        {isPending && <Loader2 className="ml-auto h-4 w-4 animate-spin text-white/50" />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-2 py-2">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-white/40">Presente</span>
          <button
            type="button"
            role="switch"
            aria-checked={view.present}
            aria-label={`Presente em ${formatDay(event.date)}`}
            disabled={isPending}
            onClick={() => run(setFlag, { metric: "attendance", value: String(!view.present) }, { present: !view.present })}
            className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-60 ${view.present ? "bg-green-600" : "bg-white/15"}`}
          >
            <span className={`absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-transform ${view.present ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {isPre ? (
          <p className="col-span-2 flex items-center rounded-xl bg-white/[0.04] px-3 text-[11px] leading-snug text-white/50">
            Pré-torneio conta só presença no Índice. Vitórias e derrotas daqui não entram no aproveitamento.
          </p>
        ) : (
          <>
            {stepper("wins", "Vitórias")}
            {stepper("losses", "Derrotas")}
          </>
        )}
      </div>
      {toggle("mvp", "Jogador Destaque do racha", view.mvp, "mvp")}
      <p className={`text-[11px] ${adjusted ? "text-amber-200/90" : "text-white/45"}`}>
        Registrado: {event.registered.present ? "presente" : "ausente"}
        {!isPre ? ` · ${event.registered.wins}V · ${event.registered.losses}D` : ""}
        {event.registered.mvp ? " · destaque" : ""}
        {event.registered.legacyWins > 0 ? ` · ${event.registered.legacyWins} vitória(s) no formato antigo (não entram no aproveitamento; use o ajuste para contar)` : ""}
      </p>
    </article>
  );
}
