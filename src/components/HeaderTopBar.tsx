"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  CircleUserRound,
  Download,
  LogOut,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { LogoMark } from "@/components/Logo";
import { AchievementEmblem, badgeGlyph, badgeTone } from "@/components/AchievementEmblem";
import { ProfileBannerArt } from "@/components/ProfileBannerArt";
import { isBannerId } from "@/lib/cosmetics";
import type { HeaderMedal } from "@/lib/profileCosmetics";
import { useCompactHeader } from "@/components/CompactAppHeader";
import { OPEN_PWA_INSTALL_EVENT } from "@/components/PwaInstallPrompt";

const PAGE_TITLES: { prefix: string; title: string; eyebrow: string }[] = [
  { prefix: "/racha", title: "Rachas", eyebrow: "Agenda VPA" },
  { prefix: "/jogadores", title: "Jogadores", eyebrow: "Nossa equipe" },
  { prefix: "/ranking", title: "Ranking", eyebrow: "Desempenho" },
  { prefix: "/selecao-do-mes", title: "Seleção do mês", eyebrow: "Esquadrão VPA" },
  { prefix: "/momentos", title: "Momentos", eyebrow: "Lances da galera" },
  { prefix: "/torneios-vpa", title: "Torneios VPA", eyebrow: "Competições" },
  { prefix: "/avisos", title: "Avisos", eyebrow: "Central VPA" },
  { prefix: "/historico", title: "Histórico", eyebrow: "Memórias VPA" },
  { prefix: "/evolucao", title: "Minha evolução", eyebrow: "Seu desempenho" },
  { prefix: "/perfil", title: "Meu perfil", eyebrow: "Identidade VPA" },
  { prefix: "/admin", title: "Administração", eyebrow: "Painel do organizador" },
];

function pageHeading(pathname: string) {
  return PAGE_TITLES.find((item) => pathname.startsWith(item.prefix)) ?? {
    title: "Início",
    eyebrow: "Vôlei por Amor",
  };
}

const STATUS_STYLE = {
  confirmed: { label: "Presença confirmada", dot: "bg-emerald-400", ring: "ring-emerald-400/50" },
  interested: { label: "Tenho interesse", dot: "bg-amber-400", ring: "ring-amber-400/50" },
  declined: { label: "Não vou", dot: "bg-white/35", ring: "ring-white/20" },
};

export function HeaderTopBar({
  fullName,
  avatarUrl,
  avatarFrame,
  nickname,
  medals = [],
  banner,
  isOrganizer,
  isVisitor = false,
  attendanceStatus,
  signOutAction,
  navigation,
  bell,
}: {
  fullName: string;
  avatarUrl: string | null;
  avatarFrame?: string | null;
  nickname?: string | null;
  /** Até 3 medalhas em destaque. */
  medals?: HeaderMedal[];
  /** Banner do perfil, em miniatura no fundo do cabeçalho. */
  banner?: string | null;
  isOrganizer: boolean;
  isVisitor?: boolean;
  attendanceStatus: string | null;
  signOutAction?: () => Promise<void>;
  /** Menu principal em telas grandes. */
  navigation: ReactNode;
  bell: ReactNode;
}) {
  const pathname = usePathname();
  const compact = useCompactHeader();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const heading = pageHeading(pathname);
  const firstName = fullName.trim().split(/\s+/)[0] || "Atleta";
  const isHome = pathname === "/";
  const eventStatus = attendanceStatus ? STATUS_STYLE[attendanceStatus as keyof typeof STATUS_STYLE] : null;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const hasBadges = Boolean(nickname) || medals.length > 0;
  const bannerId = isBannerId(banner) ? banner : null;
  const role = isOrganizer ? "Organizador" : isVisitor ? "Visitante VPA" : "Atleta VPA";

  return (
    <div className={`relative mx-auto flex max-w-5xl items-center gap-2 px-3 transition-[height] duration-300 sm:px-4 xl:max-w-7xl xl:px-6 2xl:max-w-[90rem] ${compact ? "h-[3.9rem]" : "h-16 lg:h-[4.75rem]"}`}>
      {bannerId && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[78%] opacity-70 lg:w-1/2" style={{ WebkitMaskImage: "linear-gradient(to right, #000 0%, #000 30%, transparent 100%)", maskImage: "linear-gradient(to right, #000 0%, #000 30%, transparent 100%)" }}>
          <ProfileBannerArt id={bannerId} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(26,16,73,.62), rgba(26,16,73,.3))" }} />
        </div>
      )}
      {/* O perfil fica no canto esquerdo (a foto com a moldura que a pessoa escolheu) e abre o menu. */}
      <div ref={menuRef} className="relative min-w-0 flex-1 lg:flex-none">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Abrir menu do perfil"
          className="flex max-w-full items-center gap-2.5 rounded-2xl py-1 pl-1 pr-2 text-left leading-none transition hover:bg-white/[0.06] active:scale-[0.98]"
        >
          <span className={`mt-3 flex shrink-0 items-center justify-center rounded-full ring-2 ${eventStatus?.ring ?? "ring-purple-300/25"}`}>
            <Avatar src={avatarUrl} name={fullName} size="hd" frame={avatarFrame} ring="ring-transparent" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[17px] font-black text-white lg:hidden">{isHome ? `Fala, ${firstName}!` : heading.title}</span>
            <span className="hidden max-w-32 truncate text-sm font-semibold lg:block">{firstName}</span>
            <span className={`flex items-center gap-1.5 overflow-hidden transition-all duration-300 ${compact ? "max-h-0 opacity-0" : "mt-0.5 max-h-6 opacity-100"}`}>
              {hasBadges ? (
                <>
                  {nickname && <span className="min-w-0 truncate rounded-full border border-white/20 bg-black/25 px-2 py-px text-[10px] font-semibold text-purple-50">{nickname}</span>}
                  {medals.map((medal, i) => (
                    <span key={medal.id} title={medal.title} className="home-medal shrink-0" style={{ "--d": `${i * 0.5}s` } as React.CSSProperties}>
                      <AchievementEmblem glyph={badgeGlyph(medal.emoji)} tone={badgeTone(medal.color)} shape="medal" size={20} />
                    </span>
                  ))}
                </>
              ) : (
                <span className="flex items-center gap-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/70">
                  <span className="lg:hidden">{heading.eyebrow}</span>
                  <span className="hidden items-center gap-1 normal-case tracking-normal lg:flex">{isOrganizer && <ShieldCheck className="h-2.5 w-2.5 text-amber-300" />}{role}</span>
                </span>
              )}
            </span>
          </span>
          <ChevronDown className={`hidden h-3.5 w-3.5 shrink-0 text-white/45 transition-transform lg:block ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div role="menu" className="absolute left-0 top-[calc(100%+0.6rem)] z-50 w-64 overflow-hidden rounded-2xl border border-white/15 bg-[#171039]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl animate-toast-in">
            <div className="mb-1 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 p-3">
              <p className="truncate text-sm font-semibold text-white">{fullName}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] text-purple-100/60"><Sparkles className="h-3 w-3 text-amber-300" /> Sua central pessoal VPA</p>
            </div>
            <MenuLink href="/perfil" icon={UserRound} label="Meu perfil" />
            <MenuLink href="/perfil#cartao-vpa" icon={CircleUserRound} label="Meu cartão VPA" />
            <MenuLink href="/evolucao" icon={TrendingUp} label="Minha evolução" />
            <MenuLink href="/avisos" icon={Bell} label="Avisos e notificações" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(OPEN_PWA_INSTALL_EVENT));
              }}
              className="pwa-install-menu-item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <Download className="h-4 w-4" /> Instalar aplicativo
            </button>
            {isOrganizer && <MenuLink href="/admin/reserva" icon={ShieldCheck} label="Painel do organizador" accent />}
            <div className="my-1 h-px bg-white/10" />
            {signOutAction ? (
              <form action={signOutAction}><button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-red-200/80 hover:bg-red-400/10 hover:text-red-100"><LogOut className="h-4 w-4" /> Sair da conta</button></form>
            ) : (
              <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-red-200/80"><LogOut className="h-4 w-4" /> Sair da conta</button>
            )}
          </div>
        )}
      </div>

      {navigation}
      <span className="hidden flex-1 lg:block" />

      {bell}

      {/* A logo vai pro canto direito, onde ficava o perfil. */}
      <Link href="/" aria-label="Ir para o início" className="group shrink-0">
        <LogoMark className={`object-contain transition-all duration-300 group-hover:scale-105 ${compact ? "h-11 w-11" : "h-[3.25rem] w-[3.25rem] lg:h-[4.1rem] lg:w-[4.1rem]"}`} />
      </Link>
    </div>
  );
}

function MenuLink({ href, icon: Icon, label, accent = false }: { href: string; icon: typeof UserRound; label: string; accent?: boolean }) {
  return <Link role="menuitem" href={href} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${accent ? "text-amber-200 hover:bg-amber-300/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</Link>;
}
