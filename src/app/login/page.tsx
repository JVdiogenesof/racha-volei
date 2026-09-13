import { CalendarDays, Users, Award, Megaphone, type LucideIcon } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { Logo, LogoMark } from "@/components/Logo";

const FEATURES: { title: string; desc: string; icon: LucideIcon; iconClass: string }[] = [
  {
    title: "Confirmação de presença",
    desc: "Substitui a lista manual do zap.",
    icon: CalendarDays,
    iconClass: "bg-brand-purple/30 text-purple-200",
  },
  {
    title: "Times balanceados",
    desc: "Gerados automaticamente por nível.",
    icon: Users,
    iconClass: "bg-blue-500/25 text-blue-300",
  },
  {
    title: "Ranking e Jogador Destaque",
    desc: "Veja quem mais brilha em quadra.",
    icon: Award,
    iconClass: "bg-yellow-500/25 text-yellow-300",
  },
  {
    title: "Avisos e aniversários",
    desc: "Tudo da comunidade num lugar só.",
    icon: Megaphone,
    iconClass: "bg-pink-500/25 text-pink-300",
  },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative isolate flex flex-col justify-center overflow-hidden bg-brand-navy px-8 py-16 text-white lg:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(600px circle at 15% 15%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(500px circle at 85% 85%, rgba(124,58,237,0.25), transparent 60%)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[420px] w-[420px] rotate-12 object-contain opacity-15"
        />

        <Logo className="mb-10" markClassName="h-16 w-16" />

        <span className="mb-6 inline-block w-fit rounded-full bg-brand-purple/20 px-3 py-1 text-xs font-semibold tracking-wide text-purple-200 ring-1 ring-inset ring-purple-400/30">
          RACHA DA GALERA
        </span>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          Organize o racha <span className="text-purple-300">fácil.</span>
        </h1>
        <p className="mt-4 max-w-md text-white/70">
          Confirme presença, veja os times balanceados e fique por dentro dos
          avisos do grupo — tudo num lugar só.
        </p>

        <ul className="mt-10 space-y-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${f.iconClass}`}>
                <f.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <div>
                <p className="font-medium text-white">{f.title}</p>
                <p className="text-sm text-white/60">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex flex-col items-center justify-center px-8 py-16">
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rotate-[-8deg] object-contain opacity-20"
          />
          <div className="relative">
            <LogoMark className="h-10 w-10 lg:hidden" />
            <h2 className="mt-4 text-xl font-semibold text-white lg:mt-0">Acessar conta</h2>
            <p className="mt-1 text-sm text-white/60">Entre com sua conta Google.</p>
            <div className="mt-6">
              <GoogleLoginButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
