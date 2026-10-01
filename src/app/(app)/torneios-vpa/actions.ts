"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";

export async function addReservedPlayer(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase.from("tournament_reserved_players").insert({
    profile_id: profileId,
    community,
    source_event_id: null,
    added_by: organizer.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/torneios-vpa");
}

export async function removeReservedPlayer(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase.from("tournament_reserved_players").delete().eq("profile_id", profileId).eq("community", community);
  if (error) throw new Error(error.message);

  revalidatePath("/torneios-vpa");
}

export async function clearReservedList() {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const { error } = await supabase.from("tournament_reserved_players").delete().eq("community", community).not("id", "is", null);
  if (error) throw new Error(error.message);

  revalidatePath("/torneios-vpa");
}
