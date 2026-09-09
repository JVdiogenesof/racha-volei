"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitCadastro(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const isSetter = formData.get("position") === "setter";
  const attendanceFrequency = String(formData.get("attendanceFrequency") ?? "weekly");
  const hasVpaShirt = formData.get("hasVpaShirt") === "on";
  const wantsTournaments = formData.get("wantsTournaments") === "on";

  if (!fullName || !birthdate) {
    throw new Error("Nome e data de aniversário são obrigatórios.");
  }

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      birthdate,
      phone,
      is_setter: isSetter,
      attendance_frequency: attendanceFrequency,
      has_vpa_shirt: hasVpaShirt,
      wants_tournaments: wantsTournaments,
      avatar_url: avatarUrl,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);

  redirect("/aguardando-aprovacao");
}
