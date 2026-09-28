"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfiles } from "@/lib/push";
import { SKILL_CATEGORIES } from "@/lib/scoring";

const PLAYER_LEVELS = ["beginner", "intermediate", "advanced"] as const;
const ATTENDANCE_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

export async function submitSignup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const playerLevel = String(formData.get("playerLevel") ?? "");
  const attendanceFrequency = String(formData.get("attendanceFrequency") ?? "weekly");
  const howHeard = String(formData.get("howHeard") ?? "").trim();
  const knownPeople = String(formData.get("knownPeople") ?? "").trim();
  const officialAnswer = String(formData.get("wantsOfficialMembership") ?? "");
  const isSetter = formData.get("position") === "setter";
  const hasVpaShirt = formData.get("hasVpaShirt") === "on";
  const wantsTournaments = formData.get("wantsTournaments") === "on";

  if (!fullName || !birthdate || !phone || !PLAYER_LEVELS.includes(playerLevel as (typeof PLAYER_LEVELS)[number])) {
    throw new Error("Preencha nome, aniversário, telefone e nível.");
  }
  if (!ATTENDANCE_FREQUENCIES.includes(attendanceFrequency as (typeof ATTENDANCE_FREQUENCIES)[number])) {
    throw new Error("Frequência inválida.");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  const profileData = {
    full_name: fullName,
    birthdate,
    phone,
    is_setter: isSetter,
    attendance_frequency: attendanceFrequency,
    has_vpa_shirt: hasVpaShirt,
    wants_tournaments: wantsTournaments,
    player_level: playerLevel,
    avatar_url: avatarUrl,
  };

  // Um membro promovido pela reserva pode cair aqui apenas para completar
  // dados antigos. Ele não volta para a lista nem perde a aprovação.
  if (existingProfile?.status === "approved") {
    const { error: profileError } = await supabase.from("profiles").update(profileData).eq("id", user.id);
    if (profileError) throw new Error(profileError.message);

    const ratingRows = SKILL_CATEGORIES.map((category) => ({
      profile_id: user.id,
      category,
      value: Number(formData.get(category) ?? 2.5),
    }));
    const { error: ratingsError } = await supabase
      .from("self_ratings")
      .upsert(ratingRows, { onConflict: "profile_id,category" });
    if (ratingsError) throw new Error(ratingsError.message);
    redirect("/");
  }

  if (existingProfile) redirect("/");

  if (!neighborhood || !howHeard || !knownPeople || !["yes", "no"].includes(officialAnswer)) {
    throw new Error("Preencha bairro, como conheceu o VPA, quem conhece e o interesse em ser membro.");
  }

  const ratingByCategory = Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category, Number(formData.get(category) ?? 2.5)]),
  );

  const { error } = await supabase.rpc("register_newcomer", {
    p_full_name: fullName,
    p_birthdate: birthdate,
    p_phone: phone,
    p_neighborhood: neighborhood,
    p_player_level: playerLevel,
    p_is_setter: isSetter,
    p_attendance_frequency: attendanceFrequency,
    p_has_vpa_shirt: hasVpaShirt,
    p_wants_tournaments: wantsTournaments,
    p_avatar_url: avatarUrl,
    p_how_heard: howHeard,
    p_known_people: knownPeople,
    p_wants_official_membership: officialAnswer === "yes",
    p_self_attack: ratingByCategory.attack,
    p_self_setting: ratingByCategory.setting,
    p_self_serve: ratingByCategory.serve,
    p_self_reception: ratingByCategory.reception,
    p_self_defense: ratingByCategory.defense,
    p_self_block: ratingByCategory.block,
  });
  if (error) throw new Error(error.message);

  const { data: organizers } = await supabase.from("profiles").select("id").eq("is_organizer", true);
  await sendPushToProfiles(supabase, (organizers ?? []).map((profile) => profile.id), {
    title: "Novo cadastro na lista geral",
    body: `${fullName} entrou para conhecer o VPA.`,
    url: "/admin/reserva",
  });

  redirect("/");
}
