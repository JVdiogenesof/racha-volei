import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { dispatchDueListNotifications } from "@/lib/listNotifications";

export const dynamic = "force-dynamic";

/**
 * Chamado pelo próprio banco (pg_cron + pg_net, ver
 * supabase/migrations/20261114150000_list_notifications.sql) só quando há
 * aviso de lista na hora: abertura, Lote 2, lembretes, lista lotada...
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response("Missing service key", { status: 500 });
  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // O token só existe no Vault do banco: quem confere é o próprio banco.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { data: valid } = await supabase.rpc("check_notifications_cron_token", { p_token: token });
  if (valid !== true) return new Response("Unauthorized", { status: 401 });

  try {
    const sent = await dispatchDueListNotifications(supabase);
    if (sent.length) console.info("[list-notifications]", JSON.stringify(sent));
    return Response.json({ sent });
  } catch (error) {
    console.error("[list-notifications] Falha", error instanceof Error ? error.message : error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
