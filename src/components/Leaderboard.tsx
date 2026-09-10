import type { LucideIcon } from "lucide-react";
import { Avatar } from "./Avatar";

export type RankingEntry = {
  profileId: string;
  count: number;
  fullName: string;
  avatarUrl: string | null;
};

const MEDAL_BADGE = [
  "border-yellow-300 bg-yellow-500/20 text-yellow-300",
  "border-white/15 bg-white/10 text-white/70",
  "border-orange-300 bg-orange-500/20 text-orange-300",
];

export function Leaderboard({
  title,
  icon: Icon,
  unit,
  ranking,
}: {
  title: string;
  icon: LucideIcon;
  unit: string;
  ranking: RankingEntry[];
}) {
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);
  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <section className="rounded-xl border border-white/10 p-6">
      <div className="flex items-center gap-2 text-white">
        <Icon className="h-5 w-5 text-purple-300" strokeWidth={2} />
        <h2 className="font-semibold">{title}</h2>
      </div>

      {!podium.length ? (
        <p className="mt-4 text-sm text-white/60">Ainda não tem dados suficientes.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 items-end gap-3">
            {podiumOrder.map((entry, slot) => {
              if (!entry) return <div key={slot} />;
              const place = podium.indexOf(entry);
              const isFirst = place === 0;
              return (
                <div key={entry.profileId} className="flex flex-col items-center text-center">
                  <span
                    className={`mb-1.5 rounded-full border px-2 py-0.5 text-xs font-bold ${MEDAL_BADGE[place]}`}
                  >
                    {place + 1}º
                  </span>
                  <Avatar src={entry.avatarUrl} name={entry.fullName} size={isFirst ? "lg" : "md"} />
                  <p className="mt-2 w-full truncate text-sm font-medium text-white">
                    {entry.fullName}
                  </p>
                  <p className="text-xs text-white/60">
                    {entry.count} {unit}
                  </p>
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <ul className="mt-6 divide-y divide-white/10 border-t border-white/10">
              {rest.map((entry, i) => (
                <li key={entry.profileId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center text-white/40">{i + 4}º</span>
                    <Avatar src={entry.avatarUrl} name={entry.fullName} size="sm" />
                    <span className="text-white">{entry.fullName}</span>
                  </span>
                  <span className="shrink-0 text-white/60">
                    {entry.count} {unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
