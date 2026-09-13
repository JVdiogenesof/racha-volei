import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType = "admin_pending" | "confirm" | "teams" | "mvp" | "publish_list" | "avisos";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  href: string;
};

type ProfileForNotifications = {
  id: string;
  is_organizer: boolean;
};

/**
 * Calculadas na hora a partir dos dados existentes (sem tabela de
 * notificações/estado de "lido") -- cada notificação some sozinha assim que
 * a condição que a gerou deixa de existir (aprovou o cadastro, confirmou
 * presença, escolheu o MVP, etc).
 */
export async function getNotifications(
  supabase: SupabaseClient,
  profile: ProfileForNotifications,
): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ count: pendingCount }, { data: events }, { count: newAvisosCount }] = await Promise.all([
    profile.is_organizer
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("events")
      .select("id, date, status, official_list_open, mvp_profile_id")
      .gte("date", twoWeeksAgo)
      .order("date", { ascending: true }),
    supabase.from("announcements").select("id", { count: "exact", head: true }).gte("created_at", threeDaysAgo),
  ]);

  if (pendingCount) {
    items.push({
      id: "admin-pending",
      type: "admin_pending",
      message:
        pendingCount === 1
          ? "1 solicitação de cadastro esperando aprovação"
          : `${pendingCount} solicitações de cadastro esperando aprovação`,
      href: "/admin/solicitacoes",
    });
  }

  const eventIds = (events ?? []).map((e) => e.id);

  const { data: myAttendance } = eventIds.length
    ? await supabase.from("attendance").select("event_id, status").eq("profile_id", profile.id).in("event_id", eventIds)
    : { data: [] };

  const attendanceByEvent = new Map((myAttendance ?? []).map((a) => [a.event_id, a.status]));

  for (const event of events ?? []) {
    const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const myStatus = attendanceByEvent.get(event.id);
    const activeEvent = event.status !== "finished" && event.status !== "cancelled";

    if (activeEvent && myStatus === undefined) {
      items.push({
        id: `confirm-${event.id}`,
        type: "confirm",
        message: `Diga se você tem interesse no racha de ${dateLabel}`,
        href: `/racha/${event.id}/confirmar`,
      });
    }

    if (event.status === "teams_generated" && myStatus === "confirmed") {
      items.push({
        id: `teams-${event.id}`,
        type: "teams",
        message: `Os times do racha de ${dateLabel} já estão prontos`,
        href: `/racha/${event.id}/times`,
      });
    }

    if (profile.is_organizer && activeEvent && !event.official_list_open && event.date <= tomorrow) {
      items.push({
        id: `publish-${event.id}`,
        type: "publish_list",
        message: `Publique a lista de confirmados do racha de ${dateLabel}`,
        href: `/racha/${event.id}/confirmar`,
      });
    }

    if (profile.is_organizer && event.status === "finished" && !event.mvp_profile_id) {
      items.push({
        id: `mvp-${event.id}`,
        type: "mvp",
        message: `Escolha o Jogador Destaque do racha de ${dateLabel}`,
        href: `/racha/${event.id}/mvp`,
      });
    }
  }

  if (newAvisosCount) {
    items.push({
      id: "avisos",
      type: "avisos",
      message:
        newAvisosCount === 1 ? "1 aviso novo no mural" : `${newAvisosCount} avisos novos no mural`,
      href: "/avisos",
    });
  }

  return items;
}
