"use client";

import { AchievementEmblem, GLYPH_IDS, badgeGlyph, badgeTone } from "./AchievementEmblem";
import { useMemo, useState, useTransition } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { BadgeIcon } from "./BadgeIcon";
import { useToast } from "./Toast";
import { BADGE_COLORS, BADGE_KIND_LABEL, BADGE_SWATCH, formatAwardedDate, type Badge, type BadgeColor, type BadgeKind } from "@/lib/badges";
import { awardBadge, createBadge, deleteBadge, revokeBadge } from "@/app/(app)/admin/medalhas/actions";

type Player = { id: string; name: string };
type Recent = { id: string; badgeId: string; note: string | null; awardedAt: string; playerName: string };

export function BadgeAdmin({ catalog, players, recent }: { catalog: Badge[]; players: Player[]; recent: Recent[] }) {
  const [badgeId, setBadgeId] = useState<string>(catalog[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const catalogById = new Map(catalog.map((badge) => [badge.id, badge]));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? players.filter((player) => player.name.toLowerCase().includes(q)) : players;
  }, [players, query]);

  function toggle(id: string) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function give() {
    startTransition(async () => {
      try {
        const result = await awardBadge({ badgeId, profileIds: [...picked], note, notify });
        showToast(
          result.given
            ? `Medalha entregue a ${result.given} ${result.given === 1 ? "jogador" : "jogadores"}!${result.skipped ? ` (${result.skipped} já tinham)` : ""}`
            : "Todos os escolhidos já tinham essa medalha.",
        );
        setPicked(new Set());
        setNote("");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível entregar.");
      }
    });
  }

  function revoke(id: string) {
    if (!window.confirm("Retirar essa medalha do jogador?")) return;
    startTransition(async () => {
      try {
        await revokeBadge(id);
        showToast("Medalha retirada.");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível retirar.");
      }
    });
  }

  function removeBadge(badge: Badge) {
    if (!window.confirm(`Apagar a medalha "${badge.title}"? Quem já ganhou perde ela. Isso não dá pra desfazer.`)) return;
    startTransition(async () => {
      try {
        await deleteBadge(badge.id);
        if (badgeId === badge.id) setBadgeId(catalog.find((item) => item.id !== badge.id)?.id ?? "");
        showToast("Medalha apagada.");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível apagar.");
      }
    });
  }

  const selectedBadge = catalogById.get(badgeId);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold text-white">1. Escolha a medalha</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {catalog.map((badge) => (
            <div key={badge.id} className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${badge.id === badgeId ? "border-purple-300 bg-purple-400/15" : "border-white/10 hover:border-white/30"}`}>
              <button type="button" onClick={() => setBadgeId(badge.id)} aria-pressed={badge.id === badgeId} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <BadgeIcon badge={badge} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-white">{badge.title}</span>
                  <span className="block text-[10px] text-white/45">{BADGE_KIND_LABEL[badge.kind]}</span>
                </span>
              </button>
              <button type="button" onClick={() => removeBadge(badge)} aria-label={`Apagar medalha ${badge.title}`} className="shrink-0 rounded-lg p-1.5 text-white/25 hover:bg-rose-500/15 hover:text-rose-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <NewBadgeForm onCreated={(id) => setBadgeId(id)} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold text-white">2. Quem ganha{selectedBadge ? ` · ${selectedBadge.title}` : ""}</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogador" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-purple-300/60 focus:outline-none" />
        </div>
        {picked.size > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {players.filter((player) => picked.has(player.id)).map((player) => (
              <button key={player.id} type="button" onClick={() => toggle(player.id)} className="inline-flex items-center gap-1 rounded-full bg-purple-400/20 px-2.5 py-1 text-xs font-semibold text-white">
                {player.name} <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
          </div>
        )}
        <ul className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {filtered.map((player) => {
            const on = picked.has(player.id);
            return (
              <li key={player.id}>
                <button type="button" onClick={() => toggle(player.id)} aria-pressed={on} className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm transition ${on ? "border-purple-300/60 bg-purple-400/15 text-white" : "border-white/8 text-white/75 hover:bg-white/5"}`}>
                  <span className="truncate">{player.name}</span>
                  {on && <Check className="h-4 w-4 shrink-0 text-purple-200" aria-hidden />}
                </button>
              </li>
            );
          })}
          {!filtered.length && <li className="px-1 py-2 text-sm text-white/40">Ninguém com esse nome.</li>}
        </ul>

        <h2 className="mt-5 font-semibold text-white">3. Como conquistou <span className="text-xs font-normal text-white/40">(aparece pro jogador)</span></h2>
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Ex.: Campeão da Copa VPA, edição de novembro" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-purple-300/60 focus:outline-none" />
        <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="h-4 w-4 accent-purple-400" /> Avisar o jogador por notificação
        </label>
        <button type="button" onClick={give} disabled={pending || !picked.size || !badgeId} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 text-sm font-black text-white hover:bg-brand-purple-dark disabled:opacity-50 sm:w-auto">
          {pending ? "Entregando..." : `Entregar${picked.size ? ` a ${picked.size}` : ""}`}
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold text-white">Últimas entregas</h2>
        {recent.length ? (
          <ul className="mt-3 divide-y divide-white/8">
            {recent.map((item) => {
              const badge = catalogById.get(item.badgeId);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  {badge ? <BadgeIcon badge={badge} size="sm" /> : <span className="h-9 w-9" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{item.playerName} <span className="font-normal text-white/50">· {badge?.title ?? item.badgeId}</span></p>
                    <p className="truncate text-[11px] text-white/40">{formatAwardedDate(item.awardedAt)}{item.note ? ` · ${item.note}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => revoke(item.id)} disabled={pending} aria-label="Retirar medalha" className="shrink-0 rounded-lg p-2 text-white/30 hover:bg-rose-500/15 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/45">Nenhuma medalha entregue ainda.</p>
        )}
      </section>
    </div>
  );
}

function NewBadgeForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("icon:medal");
  const [kind, setKind] = useState<BadgeKind>("event");
  const [color, setColor] = useState<BadgeColor>("amber");
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function create() {
    startTransition(async () => {
      try {
        const id = await createBadge({ title, description, emoji, kind, color });
        showToast("Medalha criada!");
        onCreated(id);
        setTitle("");
        setDescription("");
        setOpen(false);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível criar.");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 text-xs font-bold text-white/70 hover:bg-white/5">
        <Plus className="h-4 w-4" aria-hidden /> Criar nova medalha
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <AchievementEmblem glyph={badgeGlyph(emoji)} tone={badgeTone(color)} shape="medal" size={48} />
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome (ex.: Campeão do Torneio de Dezembro)" maxLength={60} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35" />
      </div>
      <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição curta" maxLength={240} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35" />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícone">
        {GLYPH_IDS.map((glyph) => (
          <button key={glyph} type="button" role="radio" aria-checked={emoji === `icon:${glyph}`} aria-label={glyph} onClick={() => setEmoji(`icon:${glyph}`)} className={`rounded-xl p-0.5 ${emoji === `icon:${glyph}` ? "bg-white/15 ring-2 ring-purple-300" : "opacity-70 hover:opacity-100"}`}>
            <AchievementEmblem glyph={glyph} tone={badgeTone(color)} shape="medal" size={34} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={kind} onChange={(event) => setKind(event.target.value as BadgeKind)} className="min-h-10 rounded-xl border border-white/10 bg-[#1b1040] px-3 text-sm text-white">
          {(Object.keys(BADGE_KIND_LABEL) as BadgeKind[]).map((item) => <option key={item} value={item}>{BADGE_KIND_LABEL[item]}</option>)}
        </select>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Cor">
          {BADGE_COLORS.map((item) => (
            <button key={item} type="button" role="radio" aria-checked={color === item} aria-label={item} onClick={() => setColor(item)} className={`h-7 w-7 rounded-full ${BADGE_SWATCH[item]} ${color === item ? "ring-2 ring-white ring-offset-2 ring-offset-[#1b1040]" : "opacity-70"}`} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={create} disabled={pending || title.trim().length < 2} className="min-h-10 rounded-xl bg-brand-purple px-4 text-sm font-black text-white disabled:opacity-50">{pending ? "Criando..." : "Criar medalha"}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/70">Cancelar</button>
      </div>
    </div>
  );
}
