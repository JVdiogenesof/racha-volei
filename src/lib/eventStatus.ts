export const EVENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: "Aberto", className: "bg-green-500/15 text-green-300" },
  teams_generated: { label: "Times gerados", className: "bg-brand-purple/20 text-purple-300" },
  in_progress: { label: "Em andamento", className: "bg-blue-500/15 text-blue-300" },
  finished: { label: "Finalizado", className: "bg-white/10 text-white/60" },
  cancelled: { label: "Cancelado", className: "bg-orange-500/15 text-orange-400" },
};
