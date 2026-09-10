import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { Logo, LogoMark } from "@/components/Logo";

const FEATURES = [
  { title: "Confirmação de presença", desc: "Substitui a lista manual do zap." },
  { title: "Times balanceados", desc: "Gerados automaticamente por nível." },
  { title: "Avisos e MVP", desc: "Tudo do racha num só lugar." },
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
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[420px] w-[420px] opacity-20"
          viewBox="0 0 40 40"
        >
          <circle cx="20" cy="20" r="19" fill="none" stroke="white" strokeWidth="0.6" />
          <path
            d="M20 1c6 5 6 33 0 38M1 20h38M6 8c8 6 20 6 28 0M6 32c8-6 20-6 28 0"
            stroke="white"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>

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
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-purple/25 text-purple-200 ring-1 ring-inset ring-purple-400/30">
                ✓
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
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-black/20">
          <LogoMark className="h-10 w-10 lg:hidden" />
          <h2 className="mt-4 text-xl font-semibold text-white lg:mt-0">Acessar conta</h2>
          <p className="mt-1 text-sm text-white/60">Entre com sua conta Google.</p>
          <div className="mt-6">
            <GoogleLoginButton />
          </div>
        </div>
      </div>
    </div>
  );
}
