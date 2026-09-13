"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfiles } from "@/lib/push";

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

  // Quem já é aprovado (ex: convidado promovido a membro permanente que só
  // faltava completar esses dados) não deve ver a tela de "aguardando
  // aprovação" de novo — vai direto pro site.
  const { data: updated } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();

  if (updated?.status === "pending") {
    const { data: organizers } = await supabase.from("profiles").select("id").eq("is_organizer", true);
    await sendPushToProfiles(supabase, (organizers ?? []).map((p) => p.id), {
      title: "Novo cadastro pendente",
      body: `${fullName} está esperando aprovação.`,
      url: "/admin/solicitacoes",
    });
  }

  redirect(updated?.status === "approved" ? "/" : "/aguardando-aprovacao");
}

export async function submitReserveSignup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName || !phone) {
    throw new Error("Nome e telefone são obrigatórios.");
  }

  const { error } = await supabase.from("reserve_list").upsert(
    { auth_user_id: user.id, full_name: fullName, phone },
    { onConflict: "auth_user_id" },
  );
  if (error) throw new Error(error.message);

  redirect("/lista-de-reserva");
}
