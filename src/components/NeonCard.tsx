import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Cartão no estilo da Copa VPA e do card do racha: borda neon que gira trocando
 * de cor. `solid` troca o fundo animado por um fundo parado (melhor pra cartões
 * longos, com muita leitura, e mais leve pro celular).
 */
const HERO = { violet: "theme-ranking", gold: "theme-gold", red: "theme-red" } as const;
const FRAME = { violet: "", gold: "theme-gold", red: "theme-red" } as const;

export function NeonCard({
  theme = "violet",
  solid = false,
  href,
  className = "",
  innerClassName = "",
  label,
  children,
}: {
  theme?: keyof typeof HERO;
  solid?: boolean;
  /** Com `href`, o cartão inteiro vira link. */
  href?: string;
  className?: string;
  innerClassName?: string;
  label?: string;
  children: ReactNode;
}) {
  const frame = `copa-frame rounded-2xl ${FRAME[theme]} ${className}`;
  const inner = `${solid ? "neon-solid" : "copa-hero copa-shine"} ${HERO[theme]} rounded-[14px] ${innerClassName}`;
  if (href) {
    return (
      <Link href={href} aria-label={label} className={`${frame} block transition active:scale-[0.99]`}>
        <div className={inner}>{children}</div>
      </Link>
    );
  }
  return (
    <section aria-label={label} className={frame}>
      <div className={inner}>{children}</div>
    </section>
  );
}
