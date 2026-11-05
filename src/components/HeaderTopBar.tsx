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
  isOrganizer,
  isVisitor = false,
  attendanceStatus,
  signOutAction,
  navigation,
  wideStrip,
  bell,
}: {
  fullName: string;
  avatarUrl: string | null;
  isOrganizer: boolean;
  isVisitor?: boolean;
  attendanceStatus: string | null;
  signOutAction?: () => Promise<void>;
  /** Menu principal em telas grandes. */
  navigation: ReactNode;
  /** Faixa da próxima ação, ao lado do menu nas telas bem largas. */
  wideStrip: ReactNode;
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

  return (
    <div className={`mx-auto flex max-w-5xl items-center gap-2 px-3 transition-[height] duration-300 sm:px-4 xl:max-w-7xl xl:px-6 2xl:max-w-[90rem] ${compact ? "h-14" : "h-[3.75rem] lg:h-[4.75rem]"}`}>
      <Link href="/" aria-label="Ir para o início" className="group shrink-0">
        <LogoMark className={`object-contain transition-all duration-300 group-hover:scale-105 ${compact ? "h-11 w-11" : "h-[3.25rem] w-[3.25rem] lg:h-[4.1rem] lg:w-[4.1rem]"}`} />
      </Link>

      <div className="min-w-0 flex-1 leading-tight lg:hidden">
        <p className="truncate text-[17px] font-black text-white">{isHome ? `Fala, ${firstName}!` : heading.title}</p>
        <p className={`truncate text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/70 transition-all duration-300 ${compact ? "max-h-0 opacity-0" : "max-h-4 opacity-100"}`}>{heading.eyebrow}</p>
      </div>

      {navigation}
      <span className="hidden flex-1 lg:block" />
      <div className={`hidden shrink-0 2xl:block ${compact ? "2xl:opacity-90" : ""}`}>{wideStrip}</div>

      {bell}

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-left leading-none shadow-lg shadow-black/10 transition hover:border-white/20 hover:bg-white/[0.13] max-sm:h-11 max-sm:w-11 max-sm:p-0 ${compact ? "gap-1 sm:p-1" : "gap-2 sm:p-1 sm:pr-2.5"}`}
        >
          <span className={`flex items-center justify-center rounded-full ring-2 ${eventStatus?.ring ?? "ring-purple-300/25"}`}><Avatar src={avatarUrl} name={fullName} size="sm" /></span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block max-w-24 truncate text-xs font-semibold">{firstName}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-white/50">{isOrganizer ? <><ShieldCheck className="h-2.5 w-2.5 text-amber-300" /> Organizador</> : isVisitor ? "Visitante VPA" : "Atleta VPA"}</span>
          </span>
          <ChevronDown className={`hidden h-3.5 w-3.5 text-white/45 transition-transform sm:block ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div role="menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-64 overflow-hidden rounded-2xl border border-white/15 bg-[#171039]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl animate-toast-in">
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
    </div>
  );
}

function MenuLink({ href, icon: Icon, label, accent = false }: { href: string; icon: typeof UserRound; label: string; accent?: boolean }) {
  return <Link role="menuitem" href={href} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${accent ? "text-amber-200 hover:bg-amber-300/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</Link>;
}
