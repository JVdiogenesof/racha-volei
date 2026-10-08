import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Clapperboard, ExternalLink, Music2, Smartphone } from "lucide-react";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Links | Vôlei Por Amor",
  description: "Todos os acessos oficiais do Vôlei Por Amor Racha.",
};

const links = [
  { href: "/", label: "Entrar no app", detail: "Rachas, times e rankings", icon: Smartphone, internal: true },
  { href: "https://www.instagram.com/rachavoleiporamor/", label: "Instagram", detail: "@rachavoleiporamor", icon: Camera },
  { href: "https://www.tiktok.com/@rachavoleiporamor", label: "TikTok", detail: "@rachavoleiporamor", icon: Music2 },
  { href: "https://drive.google.com/drive/folders/1NC15vjykfEVVpdKAdS0WBl7dZqTIC8xI", label: "Vídeos e momentos", detail: "Veja os lances da galera", icon: Clapperboard },
];

export default function LinksPage() {
  return <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-6">
    <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[radial-gradient(75%_48%_at_50%_-5%,rgba(159,122,234,.52),transparent_68%),linear-gradient(160deg,#38147d_0%,#1b0c49_48%,#090b26_100%)]" />
    <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 w-[min(120vw,52rem)] -translate-x-1/2 -translate-y-1/2 opacity-[.09]">
      <LogoMark className="h-auto w-full" />
    </div>
    <div aria-hidden="true" className="absolute -left-28 top-1/3 -z-10 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
    <div aria-hidden="true" className="absolute -right-28 bottom-1/4 -z-10 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />

    <section className="w-full max-w-md text-center">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-[1.8rem] border border-white/20 bg-white/10 p-2 shadow-[0_20px_55px_rgba(8,4,29,.45)] backdrop-blur">
        <LogoMark className="h-full w-full" />
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-purple-200">Racha VPA</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Vôlei por Amor</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/65">Escolha onde quer acompanhar a nossa galera.</p>

      <div className="mt-7 space-y-3 text-left">
        {links.map(({ href, label, detail, icon: Icon, internal }) => {
          const content = <><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-purple-400/15 text-purple-100"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-white">{label}</strong><span className="mt-0.5 block truncate text-xs text-white/55">{detail}</span></span><ExternalLink className="h-4 w-4 shrink-0 text-purple-200/75" /></>;
          const className = "group flex min-h-16 items-center gap-3 rounded-2xl border border-white/15 bg-[#160c38]/75 px-4 py-3 shadow-[0_10px_28px_rgba(4,2,18,.2)] backdrop-blur transition hover:-translate-y-0.5 hover:border-purple-200/45 hover:bg-[#24104d]/85";
          return internal ? <Link key={label} href={href} className={className}>{content}</Link> : <a key={label} href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>;
        })}
      </div>
      <p className="mt-7 text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Quadra · Areia · Uma só paixão</p>
    </section>
  </main>;
}
