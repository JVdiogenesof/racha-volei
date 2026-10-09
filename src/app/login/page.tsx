import type { Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export const viewport: Viewport = {
  themeColor: "#351080",
};

export default function LoginPage() {
  return (
    <main className="relative isolate min-h-[100svh] overflow-hidden bg-[#21065d] text-white">
      <Image
        src="/login-vpa-art.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 scale-[1.08] object-cover object-center -translate-y-[4%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(32,5,92,0.02)_0%,rgba(31,5,82,0.01)_42%,rgba(16,4,55,0.45)_72%,rgba(9,3,35,0.92)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[35svh] bg-[radial-gradient(ellipse_at_center_bottom,rgba(152,81,255,0.25),transparent_67%)]"
      />

      <div className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.15rem,env(safe-area-inset-top))] sm:px-8 sm:pb-8">
        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/75 drop-shadow-sm">
          <span className="h-px w-8 bg-white/35" />
          Comunidade VPA
          <span className="h-px w-8 bg-white/35" />
        </div>

        <section className="flex flex-1 flex-col justify-end pt-10 sm:pt-14">
          <section className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/25 bg-[#160536]/70 p-3 shadow-[0_18px_52px_rgba(7,1,27,0.45)] backdrop-blur-xl sm:p-4">
            <GoogleLoginButton />
            <p className="px-3 pb-1 pt-3 text-center text-[10px] leading-relaxed text-white/65">
              Primeiro acesso? Seu cadastro começa logo após entrar. ·{" "}
              <Link href="/privacidade" className="font-semibold text-white underline decoration-white/35 underline-offset-2 hover:text-[#eadcff]">
                Privacidade
              </Link>
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
