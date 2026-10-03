"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "./Toast";

export function ExportTeamsButton({
  eventDateLabel,
  teams,
  compact = false,
}: {
  eventDateLabel: string;
  teams: { teamNumber: number; name: string; members: { fullName: string; isSetter: boolean }[] }[];
  compact?: boolean;
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  function handleExport() {
    const lines = [`🏐 Times do racha de ${eventDateLabel}`, ""];
    for (const team of teams) {
      lines.push(`${team.name}:`);
      team.members.forEach((m, i) =>
        lines.push(`${i + 1}. ${m.isSetter ? `*${m.fullName}* 🏐 (levantador)` : m.fullName}`),
      );
      lines.push("");
    }
    const text = lines.join("\n").trim();

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        showToast("Lista copiada! Agora é só colar no grupo do zap.");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        showToast("Não foi possível copiar. Tenta de novo.");
      });
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      aria-label={copied ? "Lista de times copiada" : "Copiar lista de times"}
      title={copied ? "Lista copiada" : "Copiar lista de times"}
      className={compact ? "flex h-11 w-11 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 text-green-300 hover:bg-green-500/20" : "inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/5"}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" strokeWidth={2} />
      ) : (
        <Share2 className="h-4 w-4" strokeWidth={2} />
      )}
      {!compact && "Exportar lista"}
    </button>
  );
}
