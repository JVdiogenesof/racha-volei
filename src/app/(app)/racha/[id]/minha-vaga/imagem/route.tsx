import { createClient } from "@/lib/supabase/server";
import { imageUrlToDataUrl } from "@/lib/serverImageData";
import { SOURCE_LABEL, dateTime, eventDayLabel, money } from "@/lib/receiptFormat";
import { renderReceiptImage } from "@/lib/receiptImage";

export const dynamic = "force-dynamic";

const TZ = "America/Fortaleza";

/** Imagem do comprovante "Minha vaga" (só da própria pessoa, só se estiver confirmada). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: profile }, { data: event }, { data: attendance }, { data: payment }, { data: intent }, { data: confirmedRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("id, date, time, location, max_players").eq("id", id).maybeSingle(),
    supabase.from("attendance").select("status, confirmed_at").eq("event_id", id).eq("profile_id", user.id).maybeSingle(),
    supabase.from("payments").select("paid, payment_source, paid_at, amount").eq("event_id", id).eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("event_payment_intents")
      .select("provider_order_id, provider_payment_id")
      .eq("event_id", id)
      .eq("profile_id", user.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("attendance").select("profile_id").eq("event_id", id).eq("status", "confirmed").order("confirmed_at", { ascending: true }),
  ]);

  if (!profile || !event) return new Response("Racha não encontrado", { status: 404 });
  if (attendance?.status !== "confirmed") return new Response("Você não está confirmado(a) nesse racha.", { status: 404 });

  const order = (confirmedRows ?? []).map((row) => row.profile_id);
  const position = order.indexOf(user.id) + 1;
  const total = event.max_players ?? order.length;
  const paid = Boolean(payment?.paid);
  const day = eventDayLabel(event.date);
  const code = intent?.provider_payment_id ?? intent?.provider_order_id ?? null;

  const rows: [string, string][] = [
    ["Posição na lista", position > 0 ? `${position}º de ${total}` : "—"],
    ["Confirmado em", dateTime(attendance.confirmed_at)],
  ];
  if (paid) {
    rows.push(["Forma", payment?.payment_source ? SOURCE_LABEL[payment.payment_source] ?? payment.payment_source : "—"]);
    if (payment?.payment_source !== "exempt") rows.push(["Valor", money(payment?.amount != null ? Number(payment.amount) : null)]);
    rows.push(["Pago em", dateTime(payment?.paid_at)]);
    if (code) rows.push(["Código", code]);
  } else {
    rows.push(["Pagamento", "Pendente"]);
  }

  const logoUrl = new URL("/vpa-nova-logo.png", request.url).toString();
  const avatar = await imageUrlToDataUrl(profile.avatar_url);
  const generatedAt = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });

  return renderReceiptImage({
    fullName: profile.full_name,
    avatar,
    day,
    time: event.time ? String(event.time) : null,
    location: event.location,
    paid,
    rows,
    logoUrl,
    generatedAt,
  });
}
