"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";
import { BADGE_COLORS, type BadgeColor, type BadgeKind } from "@/lib/badges";

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Entrega uma medalha a vários jogadores de uma vez (quem já tem é ignorado). */
export async function awardBadge(input: { badgeId: string; profileIds: string[]; note: string; notify: boolean }) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileIds = [...new Set(input.profileIds)].slice(0, 200);
  if (!input.badgeId || !profileIds.length) throw new Error("Escolha a medalha e pelo menos um jogador.");
  const note = input.note.trim().slice(0, 200) || null;

  const { data: badge } = await supabase.from("badges").select("id, title, emoji").eq("id", input.badgeId).maybeSingle();
  if (!badge) throw new Error("Medalha não encontrada.");

  const { data: already } = await supabase.from("profile_badges").select("profile_id").eq("badge_id", badge.id).in("profile_id", profileIds);
  const have = new Set((already ?? []).map((row) => row.profile_id as string));
  const fresh = profileIds.filter((id) => !have.has(id));

  if (fresh.length) {
    const { error } = await supabase
      .from("profile_badges")
      .insert(fresh.map((profile_id) => ({ profile_id, badge_id: badge.id, note, awarded_by: organizer.id })));
    if (error) throw new Error(error.message);
    if (input.notify) {
      await sendPushToProfiles(supabase, fresh, {
        title: badge.emoji?.startsWith("icon:") ? "Você ganhou uma medalha!" : `Você ganhou uma medalha! ${badge.emoji}`,
        body: badge.title,
        url: "/perfil",
      });
    }
  }
  revalidatePath("/admin/medalhas");
  revalidatePath("/perfil");
  return { given: fresh.length, skipped: profileIds.length - fresh.length };
}

export async function revokeBadge(awardId: string) {
  await requireOrganizer();
  const supabase = await createClient();
  const { data: row } = await supabase.from("profile_badges").select("profile_id, badge_id").eq("id", awardId).maybeSingle();
  const { error } = await supabase.from("profile_badges").delete().eq("id", awardId);
  if (error) throw new Error(error.message);
  if (row) {
    // Se a medalha estava em destaque no cartão, tira de lá também.
    const { data: profile } = await supabase.from("profiles").select("featured_badges").eq("id", row.profile_id).maybeSingle();
    const featured = ((profile?.featured_badges as string[] | null) ?? []).filter((id) => id !== row.badge_id);
    if (profile) await supabase.from("profiles").update({ featured_badges: featured }).eq("id", row.profile_id);
  }
  revalidatePath("/admin/medalhas");
}

export async function createBadge(input: { title: string; description: string; emoji: string; kind: BadgeKind; color: BadgeColor }) {
  await requireOrganizer();
  const supabase = await createClient();
  const title = input.title.trim().slice(0, 60);
  const id = slugify(title);
  if (title.length < 2 || id.length < 2) throw new Error("Dê um nome pra medalha.");
  if (!["tournament", "event", "special"].includes(input.kind)) throw new Error("Tipo inválido.");
  if (!BADGE_COLORS.includes(input.color)) throw new Error("Cor inválida.");
  const emoji = input.emoji.trim().slice(0, 16) || "🏅";

  const { error } = await supabase.from("badges").insert({
    id,
    title,
    description: input.description.trim().slice(0, 240),
    emoji,
    kind: input.kind,
    color: input.color,
    sort_order: 100,
  });
  if (error) throw new Error(error.code === "23505" ? "Já existe uma medalha com esse nome." : error.message);
  revalidatePath("/admin/medalhas");
  revalidatePath("/perfil");
  return id;
}

export async function deleteBadge(badgeId: string) {
  await requireOrganizer();
  const supabase = await createClient();
  const { error } = await supabase.from("badges").delete().eq("id", badgeId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/medalhas");
  revalidatePath("/perfil");
}
