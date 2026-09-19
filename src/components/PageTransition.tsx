"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Anima a entrada do conteúdo a cada troca de rota (ex: clicar num ícone da
 * ilha de navegação). O `key={pathname}` força o React a tratar como um
 * elemento novo a cada navegação, o que reinicia a animação de CSS.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in min-w-0">
      {children}
    </div>
  );
}
