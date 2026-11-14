import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToProfiles, type PushPayload } from "@/lib/push";

/**
 * Avisos automáticos de lista. Quem decide QUANDO cada aviso está na hora é o
 * banco (public.pending_event_notifications); aqui a gente reserva o aviso
 * (uma vez por racha e tipo, em notification_dispatches), escolhe quem recebe
 * e manda o push.
 */
export type ListNotificationKind =
  | "list_opening_soon"
  | "list_open"
  | "lote2_open"
  | "lote1_full"
  | "list_full"
  | "last_spots"
  | "reminder_eve"
  | "reminder_day";

type EventRow = {
  id: string;
  date: string;
  time: string | null;
  location: string | null;
  community: string;
  max_players: number;
  first_batch_spots: number | null;
  second_batch_opens_at: string | null;
  registration_opens_at: string | null;
};

type Audience = "members" | "confirmed" | "interested";

const TZ = "America/Fortaleza";

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TZ });
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
}

function hourLabel(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

function instantLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function instantDayLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/** Texto e público de cada tipo de aviso. */
export function describeListNotification(
  kind: ListNotificationKind,
  event: EventRow,
  confirmed: number,
): { audience: Audience; payload: PushPayload } {
  const url = `/racha/${event.id}/confirmar`;
  const d = shortDate(event.date);
  const where = [hourLabel(event.time), event.location].filter(Boolean).join(" · ");
  const remaining = Math.max(0, event.max_players - confirmed);
  const lote2 = event.second_batch_opens_at
    ? Math.max(0, event.max_players - Math.min(event.first_batch_spots ?? event.max_players, event.max_players))
    : 0;

  switch (kind) {
    case "list_opening_soon":
      return {
        audience: "members",
        payload: {
          title: "A lista abre em 30 minutos ⏰",
          body: `Racha de ${d} abre às ${event.registration_opens_at ? instantLabel(event.registration_opens_at) : ""}. Fica de olho pra garantir sua vaga!`,
          url,
        },
      };
    case "list_open":
      return {
        audience: "members",
        payload: {
          title: "A lista abriu! 🏐",
          body: event.second_batch_opens_at && event.first_batch_spots
            ? `Lote 1 do racha de ${d} aberto: ${event.first_batch_spots} vagas. Corre garantir a sua!`
            : `Lista do racha de ${d} aberta. Corre garantir a sua vaga!`,
          url,
        },
      };
    case "lote2_open":
      return {
        audience: "members",
        payload: {
          title: "Lote 2 aberto! 🔥",
          body: `${remaining || lote2} ${remaining === 1 ? "vaga" : "vagas"} pro racha de ${d}. Quem pagar primeiro garante.`,
          url,
        },
      };
    case "lote1_full":
      return {
        audience: "interested",
        payload: {
          title: "Lote 1 esgotado",
          body: event.second_batch_opens_at
            ? `O Lote 2 do racha de ${d} abre ${instantDayLabel(event.second_batch_opens_at)}. Se alguém desistir antes, você é avisado(a).`
            : `As vagas do Lote 1 do racha de ${d} acabaram.`,
          url,
        },
      };
    case "list_full":
      return {
        audience: "interested",
        payload: {
          title: "Lista completa",
          body: `As vagas do racha de ${d} acabaram. Você continua na fila de interessados: se alguém desistir, a gente te avisa.`,
          url,
        },
      };
    case "last_spots":
      return {
        audience: "members",
        payload: {
          title: remaining === 1 ? "Última vaga! 🏃" : `Últimas ${remaining} vagas! 🏃`,
          body: `Racha de ${d}${where ? ` (${where})` : ""}. Garanta a sua antes que acabe.`,
          url,
        },
      };
    case "reminder_eve":
      return {
        audience: "confirmed",
        payload: {
          title: "Amanhã tem racha! 🏐",
          body: `${dayLabel(event.date)}${where ? `, ${where}` : ""}. Você está confirmado(a) ✅`,
          url: `/racha/${event.id}`,
        },
      };
    case "reminder_day":
      return {
        audience: "confirmed",
        payload: {
          title: "Daqui a pouco tem racha! ⏱️",
          body: `Começa às ${hourLabel(event.time)}${event.location ? ` no ${event.location}` : ""}. Bora!`,
          url: `/racha/${event.id}`,
        },
      };
  }
}

async function audienceIds(supabase: SupabaseClient, event: EventRow, audience: Audience): Promise<string[]> {
  const { data: attendance } = await supabase.from("attendance").select("profile_id, status").eq("event_id", event.id);
  const rows = attendance ?? [];
  if (audience === "confirmed") return rows.filter((a) => a.status === "confirmed").map((a) => a.profile_id);
  if (audience === "interested") return rows.filter((a) => a.status === "interested").map((a) => a.profile_id);

  // members: todo mundo aprovado da comunidade que ainda não garantiu vaga nem disse que não vai.
  const excluded = new Set(rows.filter((a) => a.status === "confirmed" || a.status === "declined").map((a) => a.profile_id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("status", "approved")
    .contains("communities", [event.community]);
  return (profiles ?? []).map((p) => p.id).filter((id) => !excluded.has(id));
}

/** Envia todos os avisos que estão na hora. Seguro rodar várias vezes: cada aviso é reservado antes de sair. */
export async function dispatchDueListNotifications(supabase: SupabaseClient) {
  const { data: pending, error } = await supabase.rpc("pending_event_notifications");
  if (error) throw new Error(error.message);
  const sent: { eventId: string; kind: string; recipients: number }[] = [];

  for (const item of (pending ?? []) as { event_id: string; kind: ListNotificationKind }[]) {
    // Reserva: se outra execução já pegou esse aviso, o insert não volta nada.
    const { data: claimed } = await supabase
      .from("notification_dispatches")
      .upsert({ event_id: item.event_id, kind: item.kind }, { onConflict: "event_id,kind", ignoreDuplicates: true })
      .select("event_id");
    if (!claimed?.length) continue;

    const { data: event } = await supabase
      .from("events")
      .select("id, date, time, location, community, max_players, first_batch_spots, second_batch_opens_at, registration_opens_at")
      .eq("id", item.event_id)
      .maybeSingle();
    if (!event) continue;
    const { count: confirmed } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "confirmed");

    const { audience, payload } = describeListNotification(item.kind, event as EventRow, confirmed ?? 0);
    const ids = await audienceIds(supabase, event as EventRow, audience);
    await sendPushToProfiles(supabase, ids, payload);
    await supabase
      .from("notification_dispatches")
      .update({ recipients: ids.length })
      .eq("event_id", item.event_id)
      .eq("kind", item.kind);
    sent.push({ eventId: item.event_id, kind: item.kind, recipients: ids.length });
  }

  return sent;
}

/**
 * Pagamento do Pix reconhecido: avisa a pessoa (uma vez só por pagamento).
 * Se a lista lotou antes, o valor virou crédito e o aviso diz isso.
 */
export async function notifyPixSettled(supabase: SupabaseClient, intentId: string) {
  try {
    const { data: intent } = await supabase
      .from("event_payment_intents")
      .select("event_id, profile_id")
      .eq("id", intentId)
      .maybeSingle();
    if (!intent) return;
    const { data: claimed } = await supabase
      .from("notification_dispatches")
      .upsert({ event_id: intent.event_id, kind: `pix_paid:${intentId}`, recipients: 1 }, { onConflict: "event_id,kind", ignoreDuplicates: true })
      .select("event_id");
    if (!claimed?.length) return;

    const [{ data: event }, { data: attendance }] = await Promise.all([
      supabase.from("events").select("date").eq("id", intent.event_id).maybeSingle(),
      supabase.from("attendance").select("status").eq("event_id", intent.event_id).eq("profile_id", intent.profile_id).maybeSingle(),
    ]);
    const d = event ? shortDate(event.date) : "";
    const payload: PushPayload =
      attendance?.status === "confirmed"
        ? { title: "Pagamento confirmado ✅", body: `Sua vaga no racha de ${d} está garantida. Toque pra ver o comprovante.`, url: `/racha/${intent.event_id}/confirmar#minha-vaga` }
        : { title: "Pagamento recebido", body: `A lista do racha de ${d} lotou antes do Pix cair, então o valor virou crédito no seu saldo.`, url: `/racha/${intent.event_id}/confirmar` };
    await sendPushToProfiles(supabase, [intent.profile_id], payload);
  } catch (error) {
    console.error("[pix-notify] Falha", error instanceof Error ? error.message : error);
  }
}
