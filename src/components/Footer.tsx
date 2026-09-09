import Link from "next/link";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500 sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <div>
            <p className="font-medium text-brand-navy">Vôlei Por Amor Racha</p>
            <p className="text-xs text-gray-400">Organização do racha da galera.</p>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          <p>
            Feito por <span className="font-medium text-gray-600">João Victor Almeida</span>
          </p>
          <Link href="/privacidade" className="hover:text-brand-purple hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
