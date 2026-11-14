"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember, requireProfile } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";
import { AVATAR_FRAMES, isAvatarFrameId } from "@/lib/avatarFrames";
import { PROFILE_BANNERS, PROFILE_EFFECTS, isBannerId, isEffectId, isUnlocked } from "@/lib/cosmetics";
import { getAchievementTracks, getUnlockedLevelIds, type AchievementStats } from "@/lib/achievements";
import { getBadgeCatalog, getEarnedBadges, getProfileExtras, badgeStatsFrom } from "@/lib/profileCosmetics";
import { getRankingCounts } from "@/lib/rankings";
import { getActiveCommunity } from "@/lib/community";

export async function updateProfileData(formData: FormData) {
  const profile = await requireMember();
  const supabase = await createClient();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const nicknameBadge = String(formData.get("nicknameBadge") ?? "").trim().slice(0, 40) || null;
  const isSetter = formData.get("position") === "setter";
  const hasVpaShirt = formData.get("hasVpaShirt") === "on";
  const wantsTournaments = formData.get("wantsTournaments") === "on";
  const playerLevel = String(formData.get("playerLevel") ?? "");

  if (!fullName || !birthdate || !["beginner", "intermediate", "advanced"].includes(playerLevel)) {
    throw new Error("Nome, data de aniversário e nível são obrigatórios.");
  }

  // avatar_url não entra aqui de propósito: é definido no cadastro (foto do
  // Google) e pode ser trocado por um organizador em /admin/jogadores — se
  // resincronizasse com o Google a cada save, apagaria a foto trocada pelo
  // organizador.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      birthdate,
      phone,
      nickname_badge: nicknameBadge,
      is_setter: isSetter,
      has_vpa_shirt: hasVpaShirt,
      wants_tournaments: wantsTournaments,
      player_level: playerLevel,
    })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/perfil");
  revalidatePath("/perfil/dados");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function updateSelfRatings(formData: FormData) {
  const profile = await requireMember();
  const supabase = await createClient();

  const rows = SKILL_CATEGORIES.map((category) => ({
    profile_id: profile.id,
    category,
    value: Number(formData.get(category) ?? 2.5),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("self_ratings")
    .upsert(rows, { onConflict: "profile_id,category" });

  if (error) throw new Error(error.message);
  revalidatePath("/perfil");
  revalidatePath("/perfil/autoavaliacao");
}

export async function savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const profile = await requireMember();
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string) {
  await requireMember();
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

/** Estatísticas que alimentam as conquistas (as mesmas da tela de perfil). */
async function loadAchievementStats(profile: Awaited<ReturnType<typeof requireMember>>): Promise<AchievementStats> {
  const supabase = await createClient();
  const community = await getActiveCommunity();
  const [counts, earned, catalog] = await Promise.all([
    getRankingCounts(supabase, community),
    getEarnedBadges(supabase, profile.id),
    getBadgeCatalog(supabase),
  ]);
  return {
    attendance: counts.attendance.get(profile.id) ?? 0,
    wins: counts.wins.get(profile.id) ?? 0,
    mvp: counts.mvp.get(profile.id) ?? 0,
    streak: counts.streaks.get(profile.id) ?? 0,
    isSetter: profile.is_setter,
    ...badgeStatsFrom(earned, catalog),
  };
}

/**
 * Equipa moldura, banner e efeito de uma vez. Cada item precisa estar liberado
 * (livre ou desbloqueado por conquista) -- ou já estar equipado, pra quem
 * escolheu antes de existirem os desbloqueios não perder o que tinha.
 */
export async function saveCosmetics(input: { frame: string | null; banner: string | null; effect: string | null }) {
  const profile = await requireMember();
  if (input.frame !== null && !isAvatarFrameId(input.frame)) throw new Error("Moldura inválida.");
  if (input.banner !== null && !isBannerId(input.banner)) throw new Error("Banner inválido.");
  if (input.effect !== null && !isEffectId(input.effect)) throw new Error("Efeito inválido.");

  const supabase = await createClient();
  const current = { frame: profile.avatar_frame, ...(await getProfileExtras(supabase, profile.id)) };
  const unlocked = getUnlockedLevelIds(await loadAchievementStats(profile));

  const checks: [string | null, string | null, readonly { id: string; unlock?: string }[], string][] = [
    [input.frame, current.frame, AVATAR_FRAMES, "Essa moldura"],
    [input.banner, current.profile_banner, PROFILE_BANNERS, "Esse banner"],
    [input.effect, current.profile_effect, PROFILE_EFFECTS, "Esse efeito"],
  ];
  for (const [wanted, equipped, catalog, label] of checks) {
    if (wanted === null || wanted === equipped) continue;
    const item = catalog.find((entry) => entry.id === wanted);
    if (!item || !isUnlocked(item, unlocked)) throw new Error(`${label} ainda está bloqueado.`);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_frame: input.frame, profile_banner: input.banner, profile_effect: input.effect })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** Até 3 medalhas em destaque no cartão; só vale medalha que a pessoa realmente ganhou. */
export async function setFeaturedBadges(badgeIds: string[]) {
  const profile = await requireMember();
  const ids = [...new Set(badgeIds)].slice(0, 3);
  const supabase = await createClient();
  if (ids.length) {
    const { data } = await supabase.from("profile_badges").select("badge_id").eq("profile_id", profile.id).in("badge_id", ids);
    const owned = new Set((data ?? []).map((row) => row.badge_id as string));
    if (ids.some((id) => !owned.has(id))) throw new Error("Você só pode destacar medalhas que já ganhou.");
  }
  const { error } = await supabase.from("profiles").update({ featured_badges: ids }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** Marca desbloqueios como já comemorados (a comemoração não repete). */
export async function markUnlocksSeen(levelIds: string[]) {
  const profile = await requireMember();
  const supabase = await createClient();
  const valid = new Set(getAchievementTracks({ attendance: 0, wins: 0, mvp: 0, streak: 0, isSetter: false }).flatMap((track) => track.levels.map((level) => level.id)));
  const incoming = levelIds.filter((id) => valid.has(id));
  if (!incoming.length) return;
  const extras = await getProfileExtras(supabase, profile.id);
  const merged = [...new Set([...extras.seen_unlocks, ...incoming])].slice(-200);
  const { error } = await supabase.from("profiles").update({ seen_unlocks: merged }).eq("id", profile.id);
  if (error) throw new Error(error.message);
}

// ── Avisos de novidade (uma vez por pessoa; fica gravado em seen_unlocks) ──────
const ANNOUNCEMENTS = new Set(["perfil-personalizacao"]);

export async function hasSeenAnnouncement(id: string) {
  if (!ANNOUNCEMENTS.has(id)) return true;
  const profile = await requireMember();
  const supabase = await createClient();
  const extras = await getProfileExtras(supabase, profile.id);
  return extras.seen_unlocks.includes(`aviso:${id}`);
}

export async function markAnnouncementSeen(id: string) {
  if (!ANNOUNCEMENTS.has(id)) return;
  const profile = await requireMember();
  const supabase = await createClient();
  const extras = await getProfileExtras(supabase, profile.id);
  const key = `aviso:${id}`;
  if (extras.seen_unlocks.includes(key)) return;
  const merged = [...extras.seen_unlocks, key].slice(-200);
  const { error } = await supabase.from("profiles").update({ seen_unlocks: merged }).eq("id", profile.id);
  if (error) throw new Error(error.message);
}

const AVATAR_MAX_BYTES = 1024 * 1024;

function avatarRevalidate() {
  revalidatePath("/", "layout");
}

/**
 * Troca a foto de perfil. Cada pessoa tem um único arquivo no Storage
 * ("<id>.webp"), sobrescrito a cada troca: a foto antiga deixa de existir.
 * O navegador já manda a imagem recortada e reduzida; aqui só se valida.
 */
export async function uploadAvatar(formData: FormData) {
  const profile = await requireProfile();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Escolha uma imagem.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("A imagem ficou grande demais. Tente outra foto.");
  if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Use uma foto JPG, PNG ou WebP.");

  const supabase = await createClient();
  const path = `${profile.id}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
  if (uploadError) throw new Error(uploadError.message);

  // O sufixo ?v= força o navegador a buscar a foto nova em vez da guardada.
  const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  avatarRevalidate();
}

/** Volta para a foto da conta Google e apaga o arquivo enviado, se houver. */
export async function resetAvatarToGoogle() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const googleUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ?? (user?.user_metadata?.picture as string | undefined) ?? null;

  await supabase.storage.from("avatars").remove([`${profile.id}.webp`]);
  const { error } = await supabase.from("profiles").update({ avatar_url: googleUrl }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  avatarRevalidate();
}
