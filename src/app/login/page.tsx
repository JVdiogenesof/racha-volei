import type { Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export const viewport: Viewport = {
  themeColor: "#eee8ff",
};

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-[100svh] overflow-hidden bg-[#f7f4ff] text-[#171039]">
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(155deg,#ffffff_0%,#f4efff_36%,#e6dcff_72%,#faf8ff_100%)]" />
      <div aria-hidden="true" className="absolute -left-28 top-[8%] -z-10 h-72 w-72 rounded-full bg-[#b595ff]/35 blur-3xl sm:h-96 sm:w-96" />
      <div aria-hidden="true" className="absolute -right-28 bottom-[12%] -z-10 h-72 w-72 rounded-full bg-[#d6c4ff]/60 blur-3xl sm:h-96 sm:w-96" />
      <div aria-hidden="true" className="absolute left-1/2 top-[42%] -z-10 h-48 w-[120%] -translate-x-1/2 -rotate-6 rounded-[50%] border border-[#6d28d9]/8 bg-white/35 blur-sm" />

      <div className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#3c2480]/55">
          <span className="h-px w-7 bg-[#6d28d9]/25" />
          Vôlei por Amor
          <span className="h-px w-7 bg-[#6d28d9]/25" />
        </div>

        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center sm:py-8">
          <div className="relative grid w-full place-items-center">
            <div aria-hidden="true" className="absolute h-56 w-56 rounded-full bg-white/75 shadow-[0_28px_90px_rgba(76,29,149,0.16)] ring-1 ring-[#6d28d9]/8 sm:h-72 sm:w-72" />
            <div aria-hidden="true" className="absolute h-44 w-44 rounded-full bg-[#d9ccff]/45 blur-2xl sm:h-56 sm:w-56" />
            <Image
              src="/logo-transparent-v2.png"
              alt="Vôlei Por Amor Racha"
              width={1280}
              height={1280}
              priority
              sizes="(max-width: 640px) 280px, 340px"
              className="relative h-auto w-[min(76vw,18rem)] drop-shadow-[0_20px_32px_rgba(39,20,94,0.2)] sm:w-[21rem]"
            />
          </div>

          <div className="mt-5 sm:mt-7">
            <h1 className="text-balance text-3xl font-black leading-[1.05] tracking-[-0.04em] text-[#201149] sm:text-4xl">
              Faça parte do nosso racha.
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#372966]/60">
              Entre com sua conta Google e venha viver o Vôlei por Amor.
            </p>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/80 bg-white/70 p-3 shadow-[0_20px_60px_rgba(54,30,113,0.12)] backdrop-blur-xl sm:p-4">
          <GoogleLoginButton />
          <p className="px-3 pb-1 pt-3 text-center text-[10px] leading-relaxed text-[#3b2b6b]/45">
            Primeiro acesso? Seu cadastro começa logo após entrar. ·{" "}
            <Link href="/privacidade" className="font-semibold underline decoration-[#6d28d9]/25 underline-offset-2 hover:text-[#4c1d95]">
              Privacidade
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
