"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Lock, Pin, PinOff, Plus, X } from "lucide-react";
import { BadgeIcon } from "./BadgeIcon";
import { useToast } from "./Toast";
import { BADGE_KIND_LABEL, formatAwardedDate, type Badge, type EarnedBadge } from "@/lib/badges";
import { setFeaturedBadges } from "@/app/(app)/perfil/actions";

export function BadgeShowcase({
  catalog,
  earned,
  featuredIds,
}: {
  catalog: Badge[];
  earned: EarnedBadge[];
  featuredIds: string[];
}) {
  const [featured, setFeatured] = useState<string[]>(featuredIds.filter((id) => earned.some((item) => item.badge_id === id)));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const earnedById = new Map(earned.map((item) => [item.badge_id, item]));
  const catalogById = new Map(catalog.map((badge) => [badge.id, badge]));
  const mine = catalog.filter((badge) => earnedById.has(badge.id));
  const missing = catalog.filter((badge) => !earnedById.has(badge.id));

  function toggleFeatured(id: string) {
    const next = featured.includes(id) ? featured.filter((item) => item !== id) : [...featured, id];
    if (next.length > 3) {
      showToast("Você pode destacar até 3 medalhas. Tire uma antes.");
      return;
    }
    const previous = featured;
    setFeatured(next);
    startTransition(async () => {
      try {
        await setFeaturedBadges(next);
        showToast(next.includes(id) ? "Medalha em destaque no seu cartão! 🏅" : "Medalha removida do destaque.");
      } catch (error) {
        setFeatured(previous);
        showToast(error instanceof Error ? error.message : "Não foi possível salvar.");
      }
    });
  }

  const detail = selected ? catalogById.get(selected) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/10 to-purple-500/10 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-white">Em destaque no cartão</h3>
          <span className="text-xs font-bold text-amber-200">{featured.length}/3</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((slot) => {
            const badge = featured[slot] ? catalogById.get(featured[slot]) : null;
            return badge ? (
              <button key={slot} type="button" onClick={() => setSelected(badge.id)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-white/30">
                <BadgeIcon badge={badge} size="lg" />
                <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-white">{badge.title}</span>
              </button>
            ) : (
              <div key={slot} className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 p-3 text-center text-white/35">
                <Plus className="h-5 w-5" aria-hidden />
                <span className="text-[10px] leading-tight">{mine.length ? "Escolha uma medalha abaixo" : "Vaga livre"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-white">Minhas medalhas</h3>
          <span className="text-xs text-white/50">{mine.length} de {catalog.length}</span>
        </div>
        {mine.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {mine.map((badge) => (
              <button key={badge.id} type="button" onClick={() => setSelected(badge.id)} className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:-translate-y-0.5 hover:border-white/30">
                {featured.includes(badge.id) && <Pin className="absolute right-2 top-2 h-3 w-3 text-amber-300" aria-label="Em destaque" />}
                <BadgeIcon badge={badge} size="lg" />
                <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-white">{badge.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-white/50">
            Você ainda não ganhou medalhas. Elas vêm de torneios e eventos especiais do VPA, entregues pela organização.
          </p>
        )}
      </section>

      {missing.length > 0 && (
        <section>
          <h3 className="font-semibold text-white">Ainda dá pra conquistar</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {missing.map((badge) => (
              <button key={badge.id} type="button" onClick={() => setSelected(badge.id)} className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.02] p-3 opacity-70 transition hover:opacity-100">
                <BadgeIcon badge={badge} size="lg" locked />
                <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-white/60">{badge.title}</span>
                <Lock className="absolute right-2 top-2 h-3 w-3 text-white/30" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      {detail && (
        <BadgeDetail
          badge={detail}
          earned={earnedById.get(detail.id) ?? null}
          featured={featured.includes(detail.id)}
          pending={pending}
          onToggle={() => toggleFeatured(detail.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** Detalhe de uma medalha: o que é, como foi conquistada e (se for sua) destacar. */
export function BadgeDetail({
  badge,
  earned,
  featured,
  pending = false,
  onToggle,
  onClose,
}: {
  badge: Badge;
  earned: EarnedBadge | null;
  featured?: boolean;
  pending?: boolean;
  onToggle?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={badge.title} className="animate-toast-in w-full max-w-sm rounded-3xl border border-white/15 bg-gradient-to-br from-[#322064] to-[#11132e] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <BadgeIcon badge={badge} size="lg" locked={!earned} />
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/55 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">Medalha · {BADGE_KIND_LABEL[badge.kind]}</p>
        <h2 className="mt-1 text-2xl font-black text-white">{badge.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{badge.description || "Medalha especial do VPA."}</p>

        <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4 text-sm">
          {earned ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Conquistada em {formatAwardedDate(earned.awarded_at)}</p>
              <p className="mt-1.5 text-white/75">{earned.note ? earned.note : "Entregue pela organização do VPA."}</p>
            </>
          ) : (
            <p className="text-white/60">Você ainda não tem essa medalha. Ela é entregue pela organização a quem participa ou conquista esse feito.</p>
          )}
        </div>

        {earned && onToggle && (
          <button type="button" onClick={onToggle} disabled={pending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#3b1975] hover:bg-purple-50 disabled:opacity-60">
            {featured ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
            {featured ? "Tirar do destaque" : "Destacar no meu cartão"}
          </button>
        )}
      </section>
    </div>,
    document.body,
  );
}
