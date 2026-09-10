import Link from "next/link";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-brand-navy">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-white/60 sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <div>
            <p className="font-medium text-white">Vôlei Por Amor Racha</p>
            <p className="text-xs text-white/40">Organização do racha da galera.</p>
          </div>
        </div>
        <div className="text-xs text-white/40">
          <p>
            Feito por <span className="font-medium text-white/70">João Victor Almeida</span>
          </p>
          <Link href="/privacidade" className="hover:text-purple-300 hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
