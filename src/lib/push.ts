import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:rachavpa@gmail.com", vapidPublicKey, vapidPrivateKey);
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Dispara notificação push pros aparelhos inscritos desses perfis. Nunca
 * lança erro pra quem chamou -- notificação é um extra, uma falha aqui não
 * pode quebrar a ação principal (publicar racha, gerar times, etc).
 * Inscrição que falha com 404/410 (aparelho não existe mais) é apagada na
 * hora, o que mantém a tabela `push_subscriptions` sempre pequena.
 */
export async function sendPushToProfiles(
  supabase: SupabaseClient,
  profileIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey || !profileIds.length) return;

  try {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("profile_id", profileIds);

    if (!subscriptions?.length) return;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }),
    );
  } catch (err) {
    console.error("Falha ao enviar notificação push:", err);
  }
}
