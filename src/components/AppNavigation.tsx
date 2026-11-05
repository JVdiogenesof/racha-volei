"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Award, CalendarDays, ChevronDown, Clapperboard, History, Home, LayoutGrid, Megaphone, ShieldCheck, Shirt, TrendingUp, Trophy, UserRound, Users } from "lucide-react";

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

/** Quadra com a escalação: ícone da Seleção do mês. */
function VolleyballCourtIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M12 4v16M3 12h18" />
      <path d="M9.5 4v16M14.5 4v16" strokeDasharray="1.5 2" opacity="0.65" />
    </svg>
  );
}

const MAIN: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/ranking", label: "Ranking", icon: Award },
  { href: "/torneios-vpa", label: "Torneios", icon: Trophy },
];
const JOGADORES: NavItem = { href: "/jogadores", label: "Jogadores", icon: Users };
const MORE: NavItem[] = [
  { href: "/selecao-do-mes", label: "Seleção do mês", icon: VolleyballCourtIcon },
  { href: "/momentos", label: "Momentos", icon: Clapperboard },
  { href: "/camisas", label: "Camisas VPA", icon: Shirt },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/evolucao", label: "Evolução", icon: TrendingUp },
  { href: "/perfil", label: "Meu perfil", icon: UserRound },
];
const ADMIN: NavItem = { href: "/admin/reserva", label: "Admin", icon: ShieldCheck };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === ADMIN.href) return pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return <span className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ${className}`}>{count > 9 ? "9+" : count}</span>;
}

type NavProps = { badgeByHref: Record<string, number>; isOrganizer: boolean };

function moreItems(isOrganizer: boolean, includePlayers: boolean) {
  return [...(includePlayers ? [JOGADORES] : []), ...MORE, ...(isOrganizer ? [ADMIN] : [])];
}

/** Menu dentro do cabeçalho, em telas grandes. */
export function DesktopNav({ badgeByHref, isOrganizer }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const extras = moreItems(isOrganizer, false);
  const moreActive = extras.some((item) => isActive(pathname, item.href));
  const moreBadge = extras.reduce((sum, item) => sum + (badgeByHref[item.href] ?? 0), 0);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
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

  const itemClass = (active: boolean) =>
    `relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-bold transition ${active ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md shadow-purple-950/30" : "text-white/65 hover:bg-white/10 hover:text-white"}`;

  return (
    <nav aria-label="Navegação principal" className="hidden shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/10 p-1 lg:flex">
      {[...MAIN, JOGADORES].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
            <item.icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
            {!active && <Badge count={badgeByHref[item.href] ?? 0} className="-right-0.5 -top-0.5" />}
          </Link>
        );
      })}
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className={itemClass(moreActive)}>
          Mais
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          <Badge count={moreBadge} className="-right-0.5 -top-0.5" />
        </button>
        {open && (
          <div role="menu" className="animate-toast-in absolute left-0 top-[calc(100%+0.6rem)] z-50 w-56 rounded-2xl border border-white/15 bg-[#171039]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
            {extras.map((item) => (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition hover:bg-white/10 ${item.href === ADMIN.href ? "text-red-200" : "text-white/80 hover:text-white"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                <Badge count={badgeByHref[item.href] ?? 0} className="right-2 top-2.5" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/** Ilha flutuante embaixo da tela no celular, na altura do polegar. */
export function BottomTabBar({ badgeByHref, isOrganizer }: NavProps) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  // O destaque anda já no toque, sem esperar a página nova carregar.
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const [ripple, setRipple] = useState<{ index: number; id: number } | null>(null);
  const extras = moreItems(isOrganizer, true);
  const moreActive = extras.some((item) => isActive(pathname, item.href));
  const moreBadge = extras.reduce((sum, item) => sum + (badgeByHref[item.href] ?? 0), 0);
  // Chegou em outra página: o toque já fez efeito (senão o botão Voltar acenderia a aba antiga).
  if (pressed && pressed.from !== pathname) setPressed(null);
  const pendingHref = pressed && pressed.from === pathname ? pressed.href : null;

  useEffect(() => {
    if (!sheet) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [sheet]);

  const routeIndex = moreActive ? MAIN.length : MAIN.findIndex((item) => isActive(pathname, item.href));
  const pendingIndex = pendingHref ? MAIN.findIndex((item) => item.href === pendingHref) : -1;
  const activeIndex = sheet ? MAIN.length : pendingIndex >= 0 ? pendingIndex : routeIndex;

  function press(index: number) {
    setRipple((current) => ({ index, id: (current?.id ?? 0) + 1 }));
    navigator.vibrate?.(8);
  }

  const tabClass = "relative z-10 flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-full py-1.5 outline-none transition-transform duration-100 ease-out [-webkit-tap-highlight-color:transparent] active:scale-90";
  const iconClass = (active: boolean) => `relative flex items-center justify-center transition-[color,transform] duration-200 ${active ? "-translate-y-px scale-110 text-white" : "text-white/70"}`;
  const labelClass = (active: boolean) => `text-[10px] font-bold leading-none transition-colors duration-200 ${active ? "text-white" : "text-white/60"}`;
  const rippleFor = (index: number) =>
    ripple?.index === index ? <span key={ripple.id} aria-hidden className="animate-tab-ripple pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" /> : null;

  return (
    <div className="lg:hidden">
      {sheet && (
        <div className="fixed inset-0 z-[45] flex items-end bg-black/50 px-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] backdrop-blur-sm" role="presentation" onClick={(event) => event.target === event.currentTarget && setSheet(false)}>
          <div role="dialog" aria-label="Mais opções" className="animate-payment-sheet-in w-full rounded-[2rem] border border-white/15 bg-[#17103a]/80 p-3 shadow-2xl shadow-black/50 backdrop-blur-2xl">
            <div className="grid grid-cols-4 gap-1.5">
              {extras.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheet(false)}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`relative flex min-h-[4.5rem] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-3xl px-1 py-2.5 text-center transition-transform duration-100 [-webkit-tap-highlight-color:transparent] active:scale-90 ${isActive(pathname, item.href) ? "bg-purple-500/30" : "bg-white/[0.06]"}`}
                >
                  <item.icon className={`h-5 w-5 ${item.href === ADMIN.href ? "text-red-300" : "text-purple-100"}`} strokeWidth={2.2} />
                  <span className="text-[10px] font-bold leading-tight text-white/90">{item.label}</span>
                  <Badge count={badgeByHref[item.href] ?? 0} className="right-1.5 top-1.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav aria-label="Navegação principal" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[46] mx-auto max-w-md rounded-full border border-white/15 bg-[#0c0722]/45 p-1 shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="relative grid grid-cols-5">
          {/* Destaque que desliza até a aba tocada */}
          <span
            aria-hidden
            className={`absolute inset-y-0 left-0 w-1/5 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-900/50 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${activeIndex < 0 ? "opacity-0" : "opacity-100"}`}
            style={{ transform: `translateX(${Math.max(0, activeIndex) * 100}%)` }}
          />
          {MAIN.map((item, index) => {
            const active = index === activeIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                onPointerDown={() => {
                  press(index);
                  setPressed({ href: item.href, from: pathname });
                }}
                onPointerCancel={() => setPressed(null)}
                onClick={() => setSheet(false)}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={tabClass}
              >
                {rippleFor(index)}
                <span className={iconClass(active)}>
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  {!active && <Badge count={badgeByHref[item.href] ?? 0} className="-right-2.5 -top-1.5" />}
                </span>
                <span className={labelClass(active)}>{item.label}</span>
              </Link>
            );
          })}
          <button type="button" onPointerDown={() => press(MAIN.length)} onClick={() => setSheet((value) => !value)} aria-expanded={sheet} className={tabClass}>
            {rippleFor(MAIN.length)}
            <span className={iconClass(MAIN.length === activeIndex)}>
              <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {!sheet && <Badge count={moreBadge} className="-right-2.5 -top-1.5" />}
            </span>
            <span className={labelClass(MAIN.length === activeIndex)}>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
