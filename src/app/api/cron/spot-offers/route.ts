import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Chamado pelo cron da Vercel (ver vercel.json) a cada poucos minutos.
 * Garante que a fila de vagas avance mesmo se ninguém abrir o app dentro da
 * 1h de prazo -- sem isso, uma oferta vencida só seria processada na próxima
 * ação de alguém naquele racha.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response("Missing service key", { status: 500 });
  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: events, error } = await supabase
    .from("events")
    .select("id")
    .in("status", ["open", "teams_generated"]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  for (const event of events ?? []) {
    await supabase.rpc("advance_spot_offer", { p_event_id: event.id });
  }

  return Response.json({ processed: events?.length ?? 0 });
}
