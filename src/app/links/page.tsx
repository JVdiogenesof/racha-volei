import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ArrowUpRight, Clapperboard } from "lucide-react";

export const metadata: Metadata = {
  title: "Links | Vôlei Por Amor",
  description: "Todos os acessos oficiais do Vôlei Por Amor Racha.",
};

type IconProps = SVGProps<SVGSVGElement>;

function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.6 6.5h.01" strokeWidth="3" />
    </svg>
  );
}

function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M15.7 3c.28 1.9 1.36 3.36 3.3 3.6v3.05a8 8 0 0 1-3.25-1.18v6.26a5.3 5.3 0 1 1-4.62-5.25v3.14a2.25 2.25 0 1 0 1.54 2.14V3h3.03Z" />
    </svg>
  );
}

function AppIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-vpa-oficial.jpg" alt="" className={className ? `${className} rounded-2xl object-cover` : "h-full w-full rounded-2xl object-cover"} />;
}

type BioLink = {
  href: string;
  label: string;
  detail: string;
  icon: ComponentType<IconProps>;
  internal?: boolean;
  accent: string;
};

const links: BioLink[] = [
  { href: "/", label: "Entrar no app", detail: "Rachas, times e rankings", icon: AppIcon, internal: true, accent: "bg-transparent text-[#31116d]" },
  { href: "https://www.instagram.com/rachavoleiporamor/", label: "Instagram", detail: "@rachavoleiporamor", icon: InstagramIcon, accent: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white" },
  { href: "https://www.tiktok.com/@rachavoleiporamor", label: "TikTok", detail: "@rachavoleiporamor", icon: TikTokIcon, accent: "bg-[#080808] text-white ring-1 ring-cyan-200/35" },
  { href: "https://drive.google.com/drive/folders/1NC15vjykfEVVpdKAdS0WBl7dZqTIC8xI", label: "Vídeos e momentos", detail: "Veja os lances da galera", icon: Clapperboard, accent: "bg-violet-400 text-[#1d0d4b]" },
];

export default function LinksPage() {
  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#12062d] px-4 py-8 text-white sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 -z-30 bg-[radial-gradient(80%_44%_at_50%_0%,#8748e5_0%,rgba(83,39,166,.75)_42%,transparent_74%),linear-gradient(155deg,#351078_0%,#17053f_52%,#090719_100%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-20 h-52 bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,.13)_49%,transparent_80%)] opacity-60" />
      <div aria-hidden="true" className="absolute left-1/2 top-[53%] -z-20 w-[min(124vw,50rem)] -translate-x-1/2 -translate-y-1/2 opacity-[.16] mix-blend-screen">
        {/* A logo oficial também forma a marca d’água por trás dos acessos. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-vpa-oficial.jpg" alt="" className="h-auto w-full rounded-[3rem] object-contain" />
      </div>
      <div aria-hidden="true" className="absolute -left-20 top-1/3 -z-20 h-56 w-56 rounded-full bg-fuchsia-400/25 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-24 bottom-1/4 -z-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />

      <section className="w-full max-w-md text-center">
        <div className="mx-auto w-28 rounded-[1.75rem] border border-white/30 bg-white/10 p-1.5 shadow-[0_22px_60px_rgba(5,1,20,.5)] backdrop-blur-sm">
          {/* A imagem é a logo oficial enviada pelo organizador. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-vpa-oficial.jpg" alt="Logo Vôlei Por Amor Racha" className="aspect-square w-full rounded-[1.4rem] object-cover" />
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.33em] text-purple-100/75">Racha VPA</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.055em] text-white">Vôlei por Amor</h1>
          <div className="mx-auto mt-3 h-px w-14 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/70">Tudo do nosso racha em um só lugar.</p>
        </div>

        <div className="mt-8 space-y-3 text-left">
          {links.map(({ href, label, detail, icon: Icon, internal, accent }) => {
            const content = (
              <>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg ${accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[15px] font-extrabold tracking-[-.015em] text-white">{label}</strong>
                  <span className="mt-0.5 block truncate text-xs text-white/60">{detail}</span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-purple-100 transition group-hover:bg-white group-hover:text-[#2e1065]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </>
            );
            const className = "group flex min-h-[4.7rem] items-center gap-3 rounded-[1.35rem] border border-white/15 bg-[#18083f]/80 px-3.5 py-3 shadow-[0_14px_32px_rgba(4,1,19,.28)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-[#29105a]/90 active:scale-[.985]";
            return internal ? <Link key={label} href={href} className={className}>{content}</Link> : <a key={label} href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>;
          })}
        </div>

        <p className="mt-8 text-[10px] font-bold uppercase tracking-[.23em] text-white/45">Quadra · Areia · Uma só paixão</p>
      </section>
    </main>
  );
}
