import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppChromeData } from "@/lib/appChromeData";
import type { Community } from "@/lib/community";
import { rachaDayParts } from "@/lib/rachaDates";
import { isListFullFor } from "@/lib/rachaSpots";
import { isRegistrationOpen } from "@/lib/registrationSchedule";

type ActionProfile = {
  id: string;
  is_organizer: boolean;
  is_setter: boolean | null;
  status: string;
  guest_for_event_id: string | null;
};

export type HeaderAction = {
  eventId: string;
  day: string;
  weekday: string;
  title: string;
  subtitle: string;
  tone: "action" | "pay" | "calm";
  /** Fim do prazo em andamento: mostra a contagem ao lado do subtítulo. */
  expiresAt?: string;
  /** Quando as inscrições abrem: a faixa se atualiza sozinha nessa hora. */
  opensAt?: string;
  /** Botão simples. Sem ele, o botão marca o interesse (ver interest). */
  cta?: { label: string; href: string; icon: "pay" | "view" | "check" };
  interest?: { price: number | null; isFull: boolean; pixEnabled: boolean };
  /** Avisa que falta pagar: os avisos da página não precisam repetir este racha. */
  coversPaymentNotice: boolean;
};

function openingLabel(opensAt: string) {
  const zone = "America/Fortaleza";
  const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: zone });
  const date = new Date(opensAt);
  const now = Date.now();
  const hour = date.toLocaleTimeString("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  if (dayKey(date) === dayKey(new Date(now))) return `hoje às ${hour}`;
  if (dayKey(date) === dayKey(new Date(now + 86_400_000))) return `amanhã às ${hour}`;
  return `${date.toLocaleDateString("pt-BR", { timeZone: zone, weekday: "short" }).replace(".", "")}, ${date.toLocaleDateString("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit" })} às ${hour}`;
}

/**
 * Escolhe o que a pessoa mais precisa fazer agora nos próximos rachas: é o que
 * aparece na faixa do cabeçalho. Quanto menor a prioridade, mais urgente.
 */
export async function getHeaderAction(
  supabase: SupabaseClient,
  profile: ActionProfile,
  community: Community,
  chromeData: Promise<AppChromeData>,
): Promise<HeaderAction | null> {
  const { upcomingEvents, attendanceByEvent } = await chromeData;
  const eventIds = upcomingEvents.slice(0, 3).map((event) => event.id);
  if (!eventIds.length) return null;

  const [{ data: events }, { data: confirmedRows }, { data: payments }, { data: reservations }, { data: offers }, { data: exemption }, { data: overrides }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, time, status, community, official_list_open, registration_opens_at, price_per_player, pix_payment_enabled, max_players, num_teams, team_size, newcomer_reserved_spots")
        .in("id", eventIds)
        .eq("community", community)
        .order("date", { ascending: true }),
      supabase.from("attendance").select("event_id, uses_setter_spot, uses_newcomer_spot").in("event_id", eventIds).eq("status", "confirmed"),
      supabase.from("payments").select("event_id, paid").in("event_id", eventIds).eq("profile_id", profile.id),
      supabase
        .from("event_payment_intents")
        .select("event_id, reservation_expires_at")
        .in("event_id", eventIds)
        .eq("profile_id", profile.id)
        .eq("status", "pending")
        .gt("reservation_expires_at", new Date().toISOString()),
      supabase
        .from("spot_offers")
        .select("event_id, expires_at")
        .in("event_id", eventIds)
        .eq("profile_id", profile.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString()),
      supabase.from("payment_exempt_profiles").select("profile_id").eq("profile_id", profile.id).maybeSingle(),
      supabase.from("event_setter_overrides").select("event_id, is_setter").in("event_id", eventIds).eq("profile_id", profile.id),
    ]);

  const exempt = Boolean(exemption);
  let best: { priority: number; action: HeaderAction } | null = null;

  for (const event of events ?? []) {
    const parts = rachaDayParts(event.date);
    const weekdayName = parts.weekdayLong.split("-")[0];
    const when = event.time ? event.time.slice(0, 5) : "";
    const rachaTitle = `Racha de ${weekdayName}${when ? ` · ${when}` : ""}`;
    const listUrl = `/racha/${event.id}/confirmar`;
    const payUrl = `${listUrl}?pagar=1`;

    const canRespond = profile.status === "approved" || (profile.status === "guest" && profile.guest_for_event_id === event.id);
    const status = attendanceByEvent.get(event.id);
    const paid = Boolean((payments ?? []).find((row) => row.event_id === event.id)?.paid);
    const price = event.price_per_player ? Number(event.price_per_player) : null;
    const pixEnabled = Boolean(event.pix_payment_enabled && price);
    const opensAt: string | null = event.registration_opens_at;
    const registrationOpen = isRegistrationOpen(opensAt, event.official_list_open);

    const rows = (confirmedRows ?? []).filter((row) => row.event_id === event.id);
    const capacity = event.max_players ?? event.num_teams * event.team_size;
    const free = Math.max(0, capacity - rows.length);
    const isSetter = (overrides ?? []).find((row) => row.event_id === event.id)?.is_setter ?? Boolean(profile.is_setter);
    let isFull = isListFullFor({
      capacity,
      newcomerReserved: event.newcomer_reserved_spots ?? 0,
      confirmed: rows.length,
      setters: rows.filter((row) => row.uses_setter_spot).length,
      newcomers: rows.filter((row) => row.uses_newcomer_spot).length,
      isSetter,
      isGuest: profile.status === "guest",
    });
    const reservation = (reservations ?? []).find((row) => row.event_id === event.id);
    const offer = (offers ?? []).find((row) => row.event_id === event.id);
    // A última vaga pode estar guardada para quem foi chamado da fila.
    if (!isFull && free <= 1 && !offer) {
      const { data: locked } = await supabase.rpc("has_active_spot_offer", { p_event_id: event.id });
      if (locked) isFull = true;
    }
    // Participantes só veem o número quando restam as últimas vagas (mesma regra da lista).
    const spotsLabel = (profile.is_organizer || free <= 10) && free > 0 ? ` · ${free} vaga${free === 1 ? "" : "s"}` : "";

    const base = { eventId: event.id, day: parts.day, weekday: parts.weekdayShort, coversPaymentNotice: false };
    const candidates: { priority: number; action: HeaderAction }[] = [];
    const add = (priority: number, action: Omit<HeaderAction, "eventId" | "day" | "weekday" | "coversPaymentNotice"> & { coversPaymentNotice?: boolean }) =>
      candidates.push({ priority, action: { ...base, ...action } });

    if (reservation) {
      add(1, { title: "Falta pagar sua vaga", subtitle: "Sua vaga está guardada", tone: "pay", expiresAt: reservation.reservation_expires_at, cta: { label: "Pagar Pix", href: listUrl, icon: "pay" }, coversPaymentNotice: true });
    } else if (offer && canRespond) {
      add(2, { title: "Abriu uma vaga pra você!", subtitle: "Garanta antes do prazo", tone: "pay", expiresAt: offer.expires_at, cta: pixEnabled ? { label: "Pagar Pix", href: payUrl, icon: "pay" } : { label: "Ver vaga", href: listUrl, icon: "view" } });
    } else if (status === "confirmed" && pixEnabled && !paid && !exempt) {
      add(3, { title: "Falta pagar sua vaga", subtitle: `Vaga garantida · ${parts.weekdayShort} ${when}`.trim(), tone: "pay", cta: { label: "Pagar Pix", href: payUrl, icon: "pay" }, coversPaymentNotice: true });
    } else if (status === "confirmed") {
      if (event.status === "teams_generated") {
        add(4, { title: "Os times já saíram!", subtitle: rachaTitle, tone: "action", cta: { label: "Ver times", href: `/racha/${event.id}/times`, icon: "view" } });
      } else {
        add(9, { title: "Você está na lista!", subtitle: rachaTitle, tone: "calm", cta: { label: "Ver lista", href: listUrl, icon: "check" } });
      }
    } else if (!canRespond || event.status === "in_progress" || event.status === "teams_generated") {
      add(10, { title: rachaTitle, subtitle: event.status === "in_progress" ? "Rolando agora" : "Acompanhe a lista", tone: "calm", cta: { label: "Ver lista", href: listUrl, icon: "view" } });
    } else if (!registrationOpen && opensAt) {
      add(8, { title: rachaTitle, subtitle: `Inscrições abrem ${openingLabel(opensAt)}`, tone: "calm", opensAt, cta: { label: "Ver racha", href: `/racha/${event.id}`, icon: "view" } });
    } else if (status === "declined") {
      add(11, { title: rachaTitle, subtitle: "Você marcou que não vai", tone: "calm", cta: { label: "Ver lista", href: listUrl, icon: "view" } });
    } else if (exempt) {
      add(5, { title: rachaTitle, subtitle: `Inscrições abertas${spotsLabel}`, tone: "action", cta: { label: "Entrar", href: listUrl, icon: "check" } });
    } else if (status === "interested") {
      if (isFull) add(7, { title: "Você está na fila de espera", subtitle: rachaTitle, tone: "calm", cta: { label: "Ver lista", href: listUrl, icon: "view" } });
      else if (pixEnabled) add(5, { title: "Falta o Pix para garantir", subtitle: `${rachaTitle}${spotsLabel}`, tone: "pay", cta: { label: "Pagar Pix", href: payUrl, icon: "pay" } });
      else add(7, { title: "Pedido enviado", subtitle: rachaTitle, tone: "calm", cta: { label: "Ver lista", href: listUrl, icon: "view" } });
    } else if (isFull) {
      add(7, { title: rachaTitle, subtitle: free > 0 ? "Vagas reservadas · só fila de espera" : "Lista cheia · só fila de espera", tone: "calm", interest: { price, isFull: true, pixEnabled } });
    } else {
      add(6, { title: rachaTitle, subtitle: `Inscrições abertas${spotsLabel}`, tone: "action", interest: { price, isFull: false, pixEnabled } });
    }

    for (const candidate of candidates) {
      if (!best || candidate.priority < best.priority) best = candidate;
    }
  }

  return best?.action ?? null;
}
