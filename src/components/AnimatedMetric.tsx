"use client";

import { useEffect, useMemo, useState } from "react";

/** Anima somente o primeiro número do texto e preserva unidade, símbolo e descrição. */
export function AnimatedMetric({ value, duration = 520, className }: { value: string | number; duration?: number; className?: string }) {
  const text = String(value);
  const metric = useMemo(() => {
    const match = text.match(/-?\d+(?:[.,]\d+)?/);
    if (!match || match.index === undefined) return null;
    const raw = match[0];
    const decimalMark = raw.includes(",") ? "," : raw.includes(".") ? "." : null;
    const decimals = decimalMark ? raw.split(decimalMark)[1]?.length ?? 0 : 0;
    return {
      start: match.index,
      end: match.index + raw.length,
      target: Number(raw.replace(",", ".")),
      decimals,
      decimalMark,
    };
  }, [text]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!metric) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reducedMotionFrame = requestAnimationFrame(() => setCurrent(metric.target));
      return () => cancelAnimationFrame(reducedMotionFrame);
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(metric.target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, metric]);

  if (!metric) return <span className={className}>{text}</span>;
  const animated = current.toFixed(metric.decimals).replace(".", metric.decimalMark ?? ".");
  return <span className={className}>{text.slice(0, metric.start)}{animated}{text.slice(metric.end)}</span>;
}
