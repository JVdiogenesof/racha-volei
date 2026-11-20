import { createClient } from "@/lib/supabase/server";
import { getBadgeCatalog } from "@/lib/profileCosmetics";
import { BadgeCelebration, type NewBadge } from "./BadgeCelebration";

/** Medalhas do organizador que a pessoa ainda não viu comemoradas (mais antigas primeiro). */
export async function BadgeCelebrationGate({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_badges")
    .select("id, badge_id, note")
    .eq("profile_id", profileId)
    .is("seen_at", null)
    .order("awarded_at", { ascending: true })
    .limit(10);
  if (!data?.length) return null;
  const catalog = new Map((await getBadgeCatalog(supabase)).map((badge) => [badge.id, badge]));
  const badges: NewBadge[] = data.flatMap((row) => {
    const badge = catalog.get(row.badge_id as string);
    return badge ? [{ awardId: row.id as string, note: (row.note as string | null) ?? null, badge }] : [];
  });
  return badges.length ? <BadgeCelebration badges={badges} /> : null;
}
