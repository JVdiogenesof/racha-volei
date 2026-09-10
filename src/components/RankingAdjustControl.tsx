"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import type { RankingMetric } from "@/lib/rankings";

export function RankingAdjustControl({
  profileId,
  metric,
  value,
  action,
}: {
  profileId: string;
  metric: RankingMetric;
  value: number;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function adjust(delta: number) {
    const formData = new FormData();
    formData.set("profileId", profileId);
    formData.set("metric", metric);
    formData.set("delta", String(delta));
    startTransition(async () => {
      try {
        await action(formData);
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível ajustar.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => adjust(-1)}
        aria-label="Diminuir"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-50"
      >
        <Minus className="h-3 w-3" strokeWidth={2} />
      </button>
      <span className="w-5 text-center text-sm font-medium text-white">
        {isPending ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : value}
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => adjust(1)}
        aria-label="Aumentar"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-50"
      >
        <Plus className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}
