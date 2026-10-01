import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/community";
import type { NotificationItem } from "@/lib/notifications";

type ChromeProfile = {
  id: string;
  is_organizer: boolean;
  status: string;
};

type ChromeEvent = {
  id: string;
  date: string;
  time: string | null;
  status: string;
  official_list_open: boolean;
  mvp_profile_id: string | null;
  mvp_profile_id_2: string | null;
};

export type AppChromeData = {
  newAvisosCount: number;
  upcomingEvents: ChromeEvent[];
  attendanceByEvent: Map<string, string>;
  notifications: NotificationItem[];
};

/**
 * Dados compartilhados pelo cabeçalho e pela ilha de notificações. Uma única
 * busca evita carregar os mesmos eventos, avisos e presenças duas vezes.
 */
export async function getAppChromeData(
  supabase: SupabaseClient,
  profile: ChromeProfile,
  community: Community,
): Promise<AppChromeData> {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ data: events }, { count: newAvisosCount }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, status, official_list_open, mvp_profile_id, mvp_profile_id_2")
      .eq("community", community)
      .gte("date", twoWeeksAgo)
      .order("date", { ascending: true })
      .order("time", { ascending: true }),
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("community", community)
      .gte("created_at", threeDaysAgo),
  ]);

  const rows = (events ?? []) as ChromeEvent[];
  const eventIds = rows.map((event) => event.id);
  const { data: attendance } = eventIds.length
    ? await supabase
        .from("attendance")
        .select("event_id, status")
        .eq("profile_id", profile.id)
        .in("event_id", eventIds)
    : { data: [] };
  const attendanceByEvent = new Map((attendance ?? []).map((row) => [row.event_id, row.status as string]));
  const upcomingEvents = rows.filter(
    (event) => event.date >= today && event.status !== "finished" && event.status !== "cancelled",
  );

  const notifications: NotificationItem[] = [];
  if (profile.status === "approved") {
    for (const event of rows) {
      const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      const attendanceStatus = attendanceByEvent.get(event.id);
      const active = event.status !== "finished" && event.status !== "cancelled";

      if (active && attendanceStatus === undefined) {
        notifications.push({ id: `confirm-${event.id}`, type: "confirm", message: `Diga se você tem interesse no racha de ${dateLabel}`, href: `/racha/${event.id}/confirmar` });
      }
      if (event.status === "teams_generated" && attendanceStatus === "confirmed") {
        notifications.push({ id: `teams-${event.id}`, type: "teams", message: `Os times do racha de ${dateLabel} já estão prontos`, href: `/racha/${event.id}/times` });
      }
      if (profile.is_organizer && active && !event.official_list_open && event.date <= tomorrow) {
        notifications.push({ id: `publish-${event.id}`, type: "publish_list", message: `Publique a lista de confirmados do racha de ${dateLabel}`, href: `/racha/${event.id}/confirmar` });
      }
      if (profile.is_organizer && event.status === "finished" && !event.mvp_profile_id && !event.mvp_profile_id_2) {
        notifications.push({ id: `mvp-${event.id}`, type: "mvp", message: `Escolha o Jogador Destaque do racha de ${dateLabel}`, href: `/racha/${event.id}/mvp` });
      }
    }

    if (newAvisosCount) {
      notifications.push({
        id: "avisos",
        type: "avisos",
        message: newAvisosCount === 1 ? "1 aviso novo no mural" : `${newAvisosCount} avisos novos no mural`,
        href: "/avisos",
      });
    }
  }

  return { newAvisosCount: newAvisosCount ?? 0, upcomingEvents, attendanceByEvent, notifications };
}
