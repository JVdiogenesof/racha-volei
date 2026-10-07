"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { BarChart3, Check, Crown, Loader2, Sparkles, StopCircle, Trophy, Users } from "lucide-react";
import { useToast } from "./Toast";

export function FinishEventCelebration({ eventId, confirmedCount, totalMatches, leaderNames, action }: {
  eventId: string;
  confirmedCount: number;
  totalMatches: number;
  leaderNames: string[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        showToast("Racha finalizado!");
        setOpen(true);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível finalizar o racha.");
      }
    });
  }

  function close() {
    setOpen(false);
    router.refresh();
  }

  return <>
    <form onSubmit={finish} aria-busy={pending} className="ml-auto shrink-0">
      <input type="hidden" name="eventId" value={eventId} />
      <button disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-light disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" strokeWidth={2} />}
        {pending ? "Finalizando..." : "Terminar evento"}
      </button>
    </form>

    {open && <div className="finish-celebration fixed inset-0 z-[130] flex items-end justify-center overflow-hidden bg-[#09051c]/90 p-0 backdrop-blur-xl sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="finish-title">
      <div aria-hidden="true" className="finish-confetti">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ "--i": index, "--x": `${(index * 43) % 100}%`, "--drift": `${((index % 3) - 1) * 45}px`, "--duration": `${1.8 + (index % 5) * 0.18}s`, "--delay": `${(index % 7) * -0.22}s` } as CSSProperties} />)}</div>
      <section className="animate-finish-card relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] border border-purple-200/20 bg-gradient-to-b from-[#4b238f] via-[#241047] to-[#120a29] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-7">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-amber-200/30 bg-amber-300/15 text-amber-200 shadow-[0_0_50px_rgba(251,191,36,0.24)]"><Trophy className="h-9 w-9" /></span>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-purple-200/70">Fim de jogo</p>
        <h2 id="finish-title" className="mt-1 text-3xl font-black text-white">Racha encerrado!</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/55">Os resultados já foram salvos nos rankings. Agora vocês podem escolher os destaques e compartilhar o resumo.</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <CelebrationStat icon={<Users className="h-4 w-4" />} label="Participantes" value={confirmedCount} />
          <CelebrationStat icon={<BarChart3 className="h-4 w-4" />} label="Confrontos" value={totalMatches} />
        </div>

        {leaderNames.length > 0 && <div className="mt-3 rounded-2xl border border-amber-200/15 bg-amber-300/[0.08] p-4">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-200/70"><Crown className="h-3.5 w-3.5" /> Mais vitórias</p>
          <p className="mt-1 font-bold text-white">{leaderNames.join(" · ")}</p>
        </div>}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link href={`/racha/${eventId}/mvp`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 text-sm font-black text-white hover:bg-purple-400"><Sparkles className="h-4 w-4" />Escolher destaques</Link>
          <Link href={`/racha/${eventId}/resumo`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 text-sm font-black text-white hover:bg-white/10"><BarChart3 className="h-4 w-4" />Ver resumo</Link>
        </div>
        <button type="button" onClick={close} className="mt-3 inline-flex min-h-10 items-center gap-1.5 px-4 text-xs font-bold text-white/45 hover:text-white"><Check className="h-4 w-4" />Fechar e voltar ao racha</button>
      </section>
    </div>}
  </>;
}

function CelebrationStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/15 p-3"><span className="mx-auto flex w-max items-center gap-1.5 text-purple-200">{icon}<strong className="text-xl text-white">{value}</strong></span><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/35">{label}</p></div>;
}
