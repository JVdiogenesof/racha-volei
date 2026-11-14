"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Palette, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { ProfileBannerArt } from "./ProfileBannerArt";
import { hasSeenAnnouncement, markAnnouncementSeen } from "@/app/(app)/perfil/actions";

const ID = "perfil-personalizacao";
const LOCAL_KEY = `vpa-aviso-${ID}`;
const FRAMES = ["coelhinho", "coroa", "sakura", "neon", "gatinho", "aura"];

/**
 * Aviso de novidade mostrado uma vez por pessoa (gravado no perfil, vale em
 * qualquer aparelho): convida a personalizar o perfil. Espera a tela assentar
 * e não abre por cima de outro aviso (instalar app, notificações).
 */
export function ProfileNewsPrompt({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LOCAL_KEY)) return;
    } catch {
      // sem armazenamento local: segue e pergunta ao servidor
    }
    if (pathname?.startsWith("/perfil")) return;
    let cancelled = false;
    let timer = 0;
    const tryOpen = async (attempt: number) => {
      if (cancelled) return;
      // Outro aviso aberto? Espera ele fechar (até ~30s).
      if (document.querySelector("body .fixed.inset-0") && attempt < 15) {
        timer = window.setTimeout(() => tryOpen(attempt + 1), 2_000);
        return;
      }
      try {
        const seen = await hasSeenAnnouncement(ID);
        if (seen) {
          try { window.localStorage.setItem(LOCAL_KEY, "1"); } catch {}
          return;
        }
        if (!cancelled) setOpen(true);
      } catch {
        // visitante ou erro de rede: não mostra
      }
    };
    timer = window.setTimeout(() => tryOpen(0), 2_500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Só na primeira carga do app; trocar de página não reabre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setFrame((value) => (value + 1) % FRAMES.length), 1_400);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  function close(goCustomize: boolean) {
    setOpen(false);
    try { window.localStorage.setItem(LOCAL_KEY, "1"); } catch {}
    markAnnouncementSeen(ID).catch(() => {});
    if (goCustomize) router.push("/perfil?aba=personalizar");
  }

  return (
    <div className="fixed inset-0 z-[97] flex items-end justify-center bg-[#08051a]/75 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="news-title" className="unlock-pop relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/15 bg-gradient-to-b from-[#2a1760] to-[#120a2e] shadow-2xl">
        <div className="relative h-28">
          <ProfileBannerArt id="logo-roxo" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#2a1760] to-transparent" />
          <span className="absolute left-4 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Novidade</span>
          <button type="button" onClick={() => close(false)} aria-label="Fechar aviso" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative px-5 pb-5">
          <div className="-mt-10 inline-flex rounded-full bg-[#241352] p-1 shadow-lg shadow-black/40">
            <Avatar key={FRAMES[frame]} src={avatarUrl} name={name} size="xl" frame={FRAMES[frame]} />
          </div>
          <h2 id="news-title" className="mt-3 text-xl font-black leading-tight text-white">Seu perfil agora é do seu jeito!</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-white/75">
            <li>🐰 Molduras, banners e efeitos animados</li>
            <li>🏅 Medalhas de torneios na sua vitrine</li>
            <li>🏆 Conquistas com níveis que liberam visuais novos</li>
          </ul>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => close(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#3b1975] hover:bg-purple-50">
              <Palette className="h-4 w-4" aria-hidden /> Personalizar agora
            </button>
            <button type="button" onClick={() => close(false)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/70 hover:bg-white/10">
              Depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
