import { CalendarCheck, Trophy, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlayerRatings, getRatingWeights } from "@/lib/ratings";
import { getRankingCounts } from "@/lib/rankings";
import { getAttendanceStreaks } from "@/lib/streak";
import { SKILL_CATEGORIES, SKILL_LABELS, finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { ScoreBar } from "@/components/ScoreBar";
import { Avatar } from "@/components/Avatar";
import { NicknameBadge } from "@/components/NicknameBadge";

export default async function PerfilPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ self, organizer }, weights, rankingCounts, streaks] = await Promise.all([
    getPlayerRatings(supabase, profile.id),
    getRatingWeights(supabase),
    getRankingCounts(supabase),
    getAttendanceStreaks(supabase),
  ]);

  const finalScores = finalScoresForPlayer(self, organizer, weights.selfWeight, weights.organizerWeight);
  const overall = overallScore(finalScores);

  const myStats = [
    { label: "Presenças", value: rankingCounts.attendance.get(profile.id) ?? 0, icon: CalendarCheck },
    { label: "Vezes destaque", value: rankingCounts.mvp.get(profile.id) ?? 0, icon: Trophy },
    { label: "Vitórias", value: rankingCounts.wins.get(profile.id) ?? 0, icon: Crown },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" streak={streaks.get(profile.id)} />
        <div>
          <h1 className="text-2xl font-bold text-white">Meu perfil</h1>
          <p className="text-sm text-white/60">
            Sua nota final combina sua autoavaliação com a nota dos organizadores.
          </p>
          <NicknameBadge text={profile.nickname_badge} className="mt-1.5" />
        </div>
      </div>

      <section>
        <h2 className="font-semibold text-white">Meu histórico</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {myStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <s.icon className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
              <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Nota final</h2>
        <p className="mt-1 text-sm text-white/60">Geral: {overall.toFixed(1)} / 5</p>
        <div className="mt-4 space-y-3">
          {SKILL_CATEGORIES.map((c) => (
            <ScoreBar key={c} label={SKILL_LABELS[c]} value={finalScores[c]} />
          ))}
        </div>
      </section>
    </div>
  );
}
