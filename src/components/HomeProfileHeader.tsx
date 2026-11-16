import Link from "next/link";
import { CalendarDays, Gauge, Trophy, UserRound } from "lucide-react";
import { Avatar } from "./Avatar";
import { ProfileBannerArt } from "./ProfileBannerArt";
import { isBannerId } from "@/lib/cosmetics";

/**
 * Cabeçalho da tela de início: o perfil da pessoa em destaque, com o banner
 * escolhido ao fundo, a foto grande com a moldura e atalhos pro perfil e o Índice.
 */
export function HomeProfileHeader({
  firstName,
  fullName,
  avatarUrl,
  avatarFrame,
  banner,
  nickname,
  position,
  showPosition,
}: {
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
  avatarFrame: string | null;
  banner: string | null;
  nickname: string | null;
  position: number | null;
  showPosition: boolean;
}) {
  const bannerId = isBannerId(banner) ? banner : "vpa";
  return (
    // O topo é folgado de propósito: a moldura passa da foto, principalmente pra cima.
    <section className="relative mt-9 rounded-3xl border border-white/15 bg-[#1a0f3f] shadow-xl shadow-purple-950/30">
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute inset-y-0 right-0 w-[78%]" style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 62%)", maskImage: "linear-gradient(to right, transparent 0%, #000 62%)" }}>
          <ProfileBannerArt id={bannerId} />
        </div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(26,15,63,.97) 0%, rgba(26,15,63,.8) 46%, rgba(26,15,63,.2) 100%)" }} />
      </div>

      <div className="relative flex items-center gap-4 px-4 pb-4 pt-4">
        <Link href="/perfil" aria-label="Abrir meu perfil" className="relative z-[5] -mt-7 shrink-0 rounded-full bg-[#241352] p-1 shadow-lg shadow-black/40 transition active:scale-95">
          <Avatar src={avatarUrl} name={fullName} size="xl" frame={avatarFrame} ring="ring-purple-200/40" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200">VPA · Racha de Quadra</p>
          <h1 className="mt-0.5 truncate text-[22px] font-extrabold leading-tight text-white sm:text-3xl">Fala, {firstName}!</h1>
          {nickname && <p className="truncate text-[11px] font-semibold text-purple-100/70">{nickname}</p>}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-1.5 border-t border-white/10 px-3 py-2.5">
        <Link href="/perfil" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-[#3b1975] transition hover:bg-purple-50">
          <UserRound className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Meu perfil
        </Link>
        {showPosition && (
          <Link
            href="/ranking"
            aria-label={position !== null ? `Sua posição no Índice VPA: ${position}º` : "Ver Índice VPA"}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-purple-300/30 bg-purple-500/20 px-2.5 text-white transition hover:bg-purple-500/30"
          >
            <Gauge className="h-4 w-4 text-purple-200" strokeWidth={2.25} aria-hidden />
            <span className="text-sm font-black leading-none">{position !== null ? `${position}º` : "—"}</span>
          </Link>
        )}
        <span className="flex-1" />
        <Link href="/ranking" aria-label="Ver ranking" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-purple-200 transition hover:bg-white/10">
          <Trophy className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </Link>
        <Link href="/racha" aria-label="Ver rachas" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-purple-200 transition hover:bg-white/10">
          <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </Link>
      </div>
    </section>
  );
}
