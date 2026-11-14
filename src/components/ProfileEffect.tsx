import type { CSSProperties } from "react";
import type { EffectId } from "@/lib/cosmetics";

/**
 * Efeito animado por cima do cartão de perfil. Só `transform` e `opacity`
 * animam (barato pra GPU) e o conjunto some com "reduzir movimento".
 * Cada partícula recebe variáveis CSS (--x, --y, --s, --d, --delay, --dx).
 */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const COUNT: Record<EffectId, number> = {
  areia: 18, bolhas: 12, coracoes: 10, estrelas: 6, neon: 0, brasas: 16, raios: 0, ondas: 4, dourado: 16, confete: 22,
  logo: 9, bolas: 8, neve: 24, vagalumes: 14, petalas: 16, chuva: 26, fogos: 5, coroas: 8,
};

const CHARS: Partial<Record<EffectId, string>> = { coracoes: "♥", bolas: "🏐", coroas: "👑", petalas: "🌸" };

export function ProfileEffect({ id }: { id: EffectId }) {
  const count = COUNT[id] ?? 0;
  return (
    <div className={`pfx pfx-${id}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const style = {
          "--x": `${Math.round(rand(i + 1) * 100)}%`,
          "--y": `${Math.round(rand(i + 31) * 100)}%`,
          "--s": `${(0.5 + rand(i + 61) * 1).toFixed(2)}`,
          "--d": `${(3 + rand(i + 91) * 5).toFixed(2)}s`,
          "--delay": `${(-rand(i + 121) * 8).toFixed(2)}s`,
          "--dx": `${Math.round((rand(i + 151) - 0.5) * 60)}px`,
          "--hue": `${Math.round(rand(i + 181) * 4)}`,
        } as CSSProperties;
        return <i key={i} style={style}>{CHARS[id] ?? null}</i>;
      })}
    </div>
  );
}
