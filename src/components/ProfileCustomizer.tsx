"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Lock, RotateCcw, Save } from "lucide-react";
import { Avatar } from "./Avatar";
import { ProfileBannerArt } from "./ProfileBannerArt";
import { ProfileHero } from "./ProfileHero";
import { AvatarUploader } from "./AvatarUploader";
import { useToast } from "./Toast";
import { AVATAR_FRAMES } from "@/lib/avatarFrames";
import { PROFILE_BANNERS, PROFILE_EFFECTS, isUnlocked, unlockLabel } from "@/lib/cosmetics";
import type { Badge } from "@/lib/badges";
import { saveCosmetics } from "@/app/(app)/perfil/actions";

type Draft = { frame: string | null; banner: string | null; effect: string | null };
type Item = { id: string; name: string; tagline: string; unlock?: string };

export function ProfileCustomizer({
  fullName,
  avatarUrl,
  nickname,
  isSetter,
  current,
  unlockedLevelIds,
  featuredBadges,
}: {
  fullName: string;
  avatarUrl: string | null;
  nickname: string | null;
  isSetter: boolean;
  current: Draft;
  unlockedLevelIds: string[];
  featuredBadges: Badge[];
}) {
  const unlocked = useMemo(() => new Set(unlockedLevelIds), [unlockedLevelIds]);
  const [saved, setSaved] = useState<Draft>(current);
  const [draft, setDraft] = useState<Draft>(current);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const dirty = draft.frame !== saved.frame || draft.banner !== saved.banner || draft.effect !== saved.effect;
  // Dá pra testar qualquer item na prévia; só não dá pra salvar o que está bloqueado.
  const blocked = (
    [
      [draft.frame, saved.frame, AVATAR_FRAMES],
      [draft.banner, saved.banner, PROFILE_BANNERS],
      [draft.effect, saved.effect, PROFILE_EFFECTS],
    ] as [string | null, string | null, readonly Item[]][]
  ).some(([wanted, equipped, list]) => {
    if (wanted === null || wanted === equipped) return false;
    const item = list.find((entry) => entry.id === wanted);
    return !item || !isUnlocked(item, unlocked);
  });

  function save() {
    startTransition(async () => {
      try {
        await saveCosmetics(draft);
        setSaved(draft);
        showToast("Visual do perfil salvo! 💜");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível salvar.");
      }
    });
  }

  function pick(field: keyof Draft, id: string | null) {
    setDraft((previous) => ({ ...previous, [field]: previous[field] === id ? (null as string | null) : id }));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/50">Prévia ao vivo</p>
        <ProfileHero
          fullName={fullName}
          avatarUrl={avatarUrl}
          avatarFrame={draft.frame}
          banner={draft.banner}
          effect={draft.effect}
          nickname={nickname}
          isSetter={isSetter}
          badges={featuredBadges}
          showEmptyBadgeSlots
        />
        <p className="mt-2 text-xs text-white/45">Toque em qualquer opção pra testar. Itens com cadeado se destravam com conquistas.</p>
      </div>

      <AvatarUploader fullName={fullName} avatarUrl={avatarUrl} frame={saved.frame} />

      <Section title="Moldura da foto" hint="Aparece no ranking, nas listas e na busca de jogadores.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <FrameTile id={null} name="Sem moldura" active={draft.frame === null} equipped={saved.frame === null} locked={false} lockText="" onPick={() => setDraft((p) => ({ ...p, frame: null }))} avatarUrl={avatarUrl} fullName={fullName} />
          {AVATAR_FRAMES.map((item: Item) => (
            <FrameTile key={item.id} id={item.id} name={item.name} active={draft.frame === item.id} equipped={saved.frame === item.id} locked={!isUnlocked(item, unlocked)} lockText={item.unlock ? unlockLabel(item.unlock) : ""} onPick={() => pick("frame", item.id)} avatarUrl={avatarUrl} fullName={fullName} />
          ))}
        </div>
      </Section>

      <Section title="Banner" hint="A capa do seu cartão de perfil.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PROFILE_BANNERS.map((item: Item) => {
            const locked = !isUnlocked(item, unlocked);
            const active = draft.banner === item.id;
            return (
              <button key={item.id} type="button" onClick={() => pick("banner", item.id)} aria-pressed={active} className={`group relative overflow-hidden rounded-2xl border text-left transition ${active ? "border-purple-300 ring-2 ring-purple-300/60" : "border-white/10 hover:border-white/30"}`}>
                <div className={`relative aspect-[3/1] ${locked ? "saturate-50" : ""}`}>
                  <ProfileBannerArt id={item.id as never} />
                  {locked && <LockOverlay text={item.unlock ? unlockLabel(item.unlock) : ""} />}
                </div>
                <div className="flex items-center justify-between gap-2 bg-black/35 px-2.5 py-1.5">
                  <span className="min-w-0 truncate text-xs font-bold text-white">{item.name}</span>
                  {saved.banner === item.id && <Equipped />}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Efeito do cartão" hint="Animação que roda por cima do seu cartão quando alguém abre seu perfil.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {PROFILE_EFFECTS.map((item) => {
            const locked = !isUnlocked(item, unlocked);
            const active = draft.effect === item.id;
            return (
              <button key={item.id} type="button" onClick={() => pick("effect", item.id)} aria-pressed={active} className={`relative rounded-2xl border p-3 text-left transition ${active ? "border-purple-300 bg-purple-400/15 ring-2 ring-purple-300/50" : "border-white/10 bg-white/[0.04] hover:border-white/30"} ${locked ? "opacity-70" : ""}`}>
                <span className="text-2xl" aria-hidden>{locked ? "🔒" : item.emoji}</span>
                <p className="mt-1 text-xs font-bold leading-tight text-white">{item.name}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-white/45">{locked && "unlock" in item && item.unlock ? `Destrava: ${unlockLabel(item.unlock)}` : item.tagline}</p>
                {saved.effect === item.id && <span className="absolute right-2 top-2"><Equipped /></span>}
              </button>
            );
          })}
          <button type="button" onClick={() => setDraft((p) => ({ ...p, effect: null }))} aria-pressed={draft.effect === null} className={`rounded-2xl border p-3 text-left transition ${draft.effect === null ? "border-purple-300 bg-purple-400/15" : "border-white/10 bg-white/[0.04] hover:border-white/30"}`}>
            <span className="text-2xl" aria-hidden>🚫</span>
            <p className="mt-1 text-xs font-bold text-white">Sem efeito</p>
            <p className="mt-0.5 text-[10px] text-white/45">Cartão limpinho</p>
          </button>
        </div>
      </Section>

      {(dirty || pending) && (
        <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-2xl border border-purple-300/30 bg-[#1b1040]/95 p-3 shadow-2xl shadow-black/50">
          <p className="min-w-0 text-xs text-white/70">{blocked ? "Tem item bloqueado na prévia: tire pra poder salvar." : "Você mudou o visual."}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setDraft(saved)} disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/80 hover:bg-white/10 disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Desfazer
            </button>
            <button type="button" onClick={save} disabled={pending || blocked} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-black text-[#3b1975] hover:bg-purple-50 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" aria-hidden /> {pending ? "Salvando..." : "Salvar visual"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-white/50">{hint}</p>
      {children}
    </section>
  );
}

function Equipped() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-400/25 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-200">
      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> Em uso
    </span>
  );
}

function LockOverlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 text-center">
      <Lock className="h-4 w-4 text-white/85" aria-hidden />
      {text && <span className="px-2 text-[10px] font-bold leading-tight text-white/85">{text}</span>}
    </div>
  );
}

function FrameTile({
  id, name, active, equipped, locked, lockText, onPick, avatarUrl, fullName,
}: {
  id: string | null; name: string; active: boolean; equipped: boolean; locked: boolean; lockText: string; onPick: () => void; avatarUrl: string | null; fullName: string;
}) {
  return (
    <button type="button" onClick={onPick} aria-pressed={active} className={`relative flex flex-col items-center rounded-2xl border px-1.5 pb-2 pt-8 text-center transition ${active ? "border-purple-300 bg-purple-400/15 ring-2 ring-purple-300/50" : "border-white/10 bg-white/[0.04] hover:border-white/30"}`}>
      {equipped && <span className="absolute right-1.5 top-1.5"><Equipped /></span>}
      <div className={locked ? "opacity-55" : ""}>
        <Avatar src={avatarUrl} name={fullName} size="md" frame={id} still />
      </div>
      <span className="mt-4 text-[11px] font-bold leading-tight text-white">{name}</span>
      {locked && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold leading-tight text-amber-200/90">
          <Lock className="h-2.5 w-2.5" aria-hidden /> {lockText}
        </span>
      )}
    </button>
  );
}
