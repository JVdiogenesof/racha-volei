import { Crown, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { Community } from "@/lib/community";
import type { MonthlySelection, MonthlySelectionPlayer } from "@/lib/monthlySelection";

const PLAYER_POSITIONS = [
  "left-[17%] top-[24%]",
  "left-1/2 top-[24%]",
  "left-[17%] top-[67%]",
  "left-1/2 top-[67%]",
  "left-[83%] top-[67%]",
];

function CourtPlayer({ player, position, featured = false }: { player: MonthlySelectionPlayer; position: string; featured?: boolean }) {
  return (
    <div className={`absolute z-10 flex w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center ${position}`}>
      <div className={`relative rounded-full p-0.5 shadow-xl ${featured ? "bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600" : "bg-white/80"}`}>
        <Avatar src={player.avatarUrl} name={player.fullName} size="lg" />
        {featured && (
          <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[#30205f] bg-amber-300 text-amber-950 shadow-lg">
            <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className={`mt-1.5 max-w-full rounded-xl border px-2 py-1 shadow-lg backdrop-blur-md ${featured ? "border-amber-200/40 bg-amber-300/90 text-amber-950" : "border-white/20 bg-[#1b1142]/85 text-white"}`}>
        <p className="truncate text-[10px] font-black leading-tight sm:text-xs">{player.fullName}</p>
        <p className={`mt-0.5 text-[8px] font-bold uppercase tracking-wide ${featured ? "text-amber-900/70" : "text-purple-200/65"}`}>
          {featured ? `Levantador(a) · ${player.selectionScore.toFixed(1)} pts` : `${player.selectionScore.toFixed(1)} pts`}
        </p>
      </div>
    </div>
  );
}

export function MonthlySelectionCourt({
  selection,
  community,
  monthLabel,
}: {
  selection: MonthlySelection;
  community: Community;
  monthLabel: string;
}) {
  if (!selection.setter) return null;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-purple-200/20 bg-[#120d2d] shadow-2xl shadow-purple-950/30">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-purple-600/25 to-fuchsia-400/5 px-4 py-4 sm:px-6">
        <div>
          <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-200"><Sparkles className="h-3.5 w-3.5" /> Esquadrão VPA</p>
          <h2 className="mt-1 text-xl font-black text-white">Seleção de <span className="capitalize">{monthLabel}</span></h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-purple-100">
          {community === "sand" ? "Areia" : "Quadra"}
        </span>
      </div>

      <div className="p-3 sm:p-6">
        <div className={`relative mx-auto aspect-[3/4] w-full max-w-xl overflow-hidden rounded-2xl border-4 border-white/80 shadow-inner ${community === "sand" ? "bg-[linear-gradient(125deg,#d8ad62,#edca82_42%,#c99348)]" : "bg-[linear-gradient(115deg,#6541a5,#7954bd_45%,#52318f)]"}`}>
          <div className="absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_34px,white_35px,transparent_36px)]" />
          <div className="absolute left-0 right-0 top-[8%] z-20 h-1 bg-white shadow-[0_2px_8px_rgba(255,255,255,.55)]" />
          <div className="absolute left-0 right-0 top-[8%] z-20 h-4 -translate-y-full border-y border-white/50 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.7)_0,rgba(255,255,255,.7)_2px,transparent_2px,transparent_18px)]" />
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/75" />
          <div className="absolute bottom-0 left-1/2 top-[8%] w-0.5 -translate-x-1/2 bg-white/20" />
          <div className="absolute inset-x-0 bottom-3 text-center text-[9px] font-black uppercase tracking-[0.32em] text-white/35">Vôlei por Amor</div>

          {selection.players.map((player, index) => (
            <CourtPlayer key={player.profileId} player={player} position={PLAYER_POSITIONS[index]} />
          ))}
          <CourtPlayer player={selection.setter} position="left-[83%] top-[24%]" featured />
        </div>
      </div>
    </section>
  );
}
