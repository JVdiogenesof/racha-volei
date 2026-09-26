"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  LogOut,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { LogoMark } from "@/components/Logo";
import { useCompactHeader } from "@/components/CompactAppHeader";

export type HeaderEventSummary = {
  id: string;
  dateLabel: string;
  time: string | null;
  startsAt: string;
  attendanceStatus: "confirmed" | "interested" | "declined" | null;
};

const PAGE_TITLES: { prefix: string; title: string; eyebrow: string }[] = [
  { prefix: "/racha", title: "Rachas", eyebrow: "Agenda VPA" },
  { prefix: "/jogadores", title: "Jogadores", eyebrow: "Nossa equipe" },
  { prefix: "/ranking", title: "Ranking", eyebrow: "Desempenho" },
  { prefix: "/reacoes", title: "Queridômetro", eyebrow: "Clima da semana" },
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

function formatCountdown(startsAt: string, now: number | null) {
  if (now === null) return "Calculando...";
  const difference = new Date(startsAt).getTime() - now;
  if (difference <= 0) return "Racha em andamento";

  const totalMinutes = Math.ceil(difference / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Faltam ${days}d ${hours}h`;
  if (hours > 0) return `Faltam ${hours}h ${minutes}min`;
  return `Faltam ${minutes}min`;
}

export function HeaderTopBar({
  fullName,
  avatarUrl,
  isOrganizer,
  isVisitor = false,
  nextEvent,
  signOutAction,
  previewPath,
}: {
  fullName: string;
  avatarUrl: string | null;
  isOrganizer: boolean;
  isVisitor?: boolean;
  nextEvent: HeaderEventSummary | null;
  signOutAction?: () => Promise<void>;
  previewPath?: string;
}) {
  const pathname = usePathname();
  const compact = useCompactHeader();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const heading = pageHeading(previewPath ?? pathname);
  const firstName = fullName.trim().split(/\s+/)[0] || "Atleta";
  const eventStatus = nextEvent?.attendanceStatus ? STATUS_STYLE[nextEvent.attendanceStatus] : null;
  const countdown = nextEvent ? formatCountdown(nextEvent.startsAt, now) : null;

  useEffect(() => {
    const update = window.setInterval(() => setNow(Date.now()), 30_000);
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    return () => {
      window.clearInterval(update);
      window.clearTimeout(initial);
    };
  }, []);

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
    <div className={`mx-auto flex max-w-5xl items-center px-3 transition-[height,padding] duration-300 sm:px-4 ${compact ? "h-14" : "h-[4.5rem] sm:h-20"}`}>
      <Link href="/" aria-label="Ir para o início" className="group flex shrink-0 items-center gap-2.5">
        <span className={`relative grid place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-black/20 transition-all duration-300 group-hover:bg-white/15 ${compact ? "h-9 w-9" : "h-11 w-11"}`}>
          <LogoMark className={`object-contain transition-all duration-300 ${compact ? "h-8 w-8" : "h-10 w-10"}`} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#29165f] bg-emerald-400" />
        </span>
        <span className="hidden leading-none sm:block">
          <strong className="block text-sm tracking-[0.14em] text-white">VPA</strong>
          <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-purple-200/70">Vôlei por Amor</span>
        </span>
      </Link>

      <span className="mx-3 h-8 w-px shrink-0 bg-white/12 sm:mx-4" />

      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold text-white transition-all duration-300 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>{heading.title}</p>
        <p className={`truncate text-[10px] font-medium uppercase tracking-[0.12em] text-purple-200/70 transition-all duration-300 ${compact ? "max-h-0 opacity-0" : "mt-1 max-h-4 opacity-100"}`}>
          <span className="md:hidden">{countdown ?? heading.eyebrow}</span>
          <span className="hidden md:inline">{heading.eyebrow}</span>
        </p>
      </div>

      {nextEvent && (
        <Link
          href={`/racha/${nextEvent.id}`}
          className="mr-2 hidden min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/10 md:flex"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-400/15 text-purple-200"><CalendarDays className="h-4 w-4" /></span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">Próximo racha{countdown ? ` · ${countdown}` : ""}</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-white/90">{nextEvent.dateLabel}{nextEvent.time ? ` · ${nextEvent.time.slice(0, 5)}` : ""}</span>
          </span>
          {eventStatus && <span title={eventStatus.label} className={`h-2 w-2 shrink-0 rounded-full ${eventStatus.dot}`} />}
        </Link>
      )}

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
            {isOrganizer && <MenuLink href="/admin" icon={ShieldCheck} label="Painel do organizador" accent />}
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
