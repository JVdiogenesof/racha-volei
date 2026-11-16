import Link from "next/link";
import { ChevronRight, Gauge } from "lucide-react";
import { Avatar } from "./Avatar";
import { NeonCard } from "./NeonCard";
import { ProfileBannerArt } from "./ProfileBannerArt";
import { isBannerId } from "@/lib/cosmetics";

/**
 * Cabeçalho da tela de início, compacto: foto com a moldura escolhida, saudação
 * e posição no Índice, no mesmo estilo neon dos cartões da Copa e do racha. O
 * banner do perfil aparece de leve do lado direito. A foto fica fora do cartão
 * (que corta o que passa da borda) pra moldura poder sair por cima.
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
  const bannerId = isBannerId(banner) ? banner : null;
  return (
    <div className={`relative ${avatarFrame ? "mt-4" : ""}`}>
      <NeonCard innerClassName="min-h-[4.5rem]">
        {bannerId && (
          <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 opacity-60" style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 70%)", maskImage: "linear-gradient(to right, transparent 0%, #000 70%)" }}>
            <ProfileBannerArt id={bannerId} />
          </div>
        )}
        <div className="relative z-10 flex min-h-[4.5rem] items-center gap-3 py-2.5 pl-[5.25rem] pr-3">
          <Link href="/perfil" className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate text-xl font-extrabold text-white sm:text-2xl">Fala, {firstName}!</h1>
            <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] font-semibold text-purple-100/80">
              {nickname ? <span className="truncate">{nickname}</span> : <>Meu perfil</>}
              <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            </p>
          </Link>
          {showPosition && (
            <Link
              href="/ranking"
              aria-label={position !== null ? `Sua posição no Índice VPA: ${position}º` : "Ver Índice VPA"}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-black/25 px-3 text-white backdrop-blur-sm transition hover:bg-black/35"
            >
              <Gauge className="h-4 w-4 text-purple-200" strokeWidth={2.25} aria-hidden />
              <span className="text-[15px] font-black leading-none">{position !== null ? `${position}º` : "—"}</span>
            </Link>
          )}
        </div>
      </NeonCard>
      <Link href="/perfil" aria-label="Abrir meu perfil" className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full transition active:scale-95" style={avatarFrame ? { top: "calc(50% + 2px)" } : undefined}>
        <Avatar src={avatarUrl} name={fullName} size="lg" frame={avatarFrame} ring="ring-purple-200/50" />
      </Link>
    </div>
  );
}
