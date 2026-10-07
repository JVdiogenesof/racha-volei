"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Community } from "@/lib/community";

/**
 * Anima a entrada do conteúdo a cada troca de rota (ex: clicar num ícone da
 * ilha de navegação). O `key={pathname}` força o React a tratar como um
 * elemento novo a cada navegação, o que reinicia a animação de CSS.
 */
export function PageTransition({ children, community }: { children: ReactNode; community: Community }) {
  const pathname = usePathname();
  return (
    <div key={`${pathname}-${community}`} className="animate-page-in page-stagger min-w-0">
      {children}
    </div>
  );
}
