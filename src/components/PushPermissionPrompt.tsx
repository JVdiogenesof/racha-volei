"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BellRing, Loader2, X } from "lucide-react";
import { savePushSubscription } from "@/app/(app)/perfil/actions";
import { getCurrentPushSubscription, subscribeToPush, supportsPushNotifications } from "@/lib/pushClient";
import { useToast } from "./Toast";

const DISMISSED_AT_KEY = "vpa-push-prompt-dismissed-at";
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1_000;

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isRunningAsApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function recentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REMIND_AFTER_MS;
}

export function PushPermissionPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function check() {
      if (!isRunningAsApp() || !supportsPushNotifications() || Notification.permission === "denied" || recentlyDismissed()) return;
      try {
        const subscription = await getCurrentPushSubscription();
        if (subscription) {
          await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
        } else if (!cancelled) {
          timer = window.setTimeout(() => setOpen(true), 1_500);
        }
      } catch {
        // A tela de notificações continua disponível caso a checagem automática falhe.
      }
    }

    void check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setOpen(false);
  }

  async function activate() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      showToast("Notificações ainda não configuradas nesse ambiente.");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setOpen(false);
        showToast("Permissão não concedida. Você pode ativar depois no Perfil.");
        return;
      }

      const subscription = await subscribeToPush(publicKey);
      await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      window.localStorage.removeItem(DISMISSED_AT_KEY);
      setOpen(false);
      showToast("Notificações ativadas!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#08051a]/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
      <section role="dialog" aria-modal="true" aria-labelledby="push-permission-title" className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#18103b] shadow-2xl shadow-black/60 animate-pwa-sheet-in">
        <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_right,rgba(192,132,252,0.4),transparent_65%)]" />
        <button type="button" onClick={dismiss} aria-label="Fechar aviso de notificações" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/20 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-5 pt-6 sm:p-6">
          <div className="flex items-center gap-4 pr-8">
            <span className="relative h-16 w-16 shrink-0">
              <span className="grid h-full w-full place-items-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-purple-950/40">
                <Image src="/pwa-icon-v2-192.png" alt="Vôlei por Amor" width={64} height={64} className="h-full w-full object-cover" priority />
              </span>
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-fuchsia-500 text-white ring-2 ring-[#18103b]">
                <BellRing className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fuchsia-200/75">Não perca sua vaga</p>
              <h2 id="push-permission-title" className="mt-1 text-xl font-black leading-tight text-white">Ative as notificações do VPA</h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-white/70">
            Receba avisos de racha novo, lista publicada, times prontos e recados importantes direto no celular.
          </p>

          <button type="button" onClick={activate} disabled={busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/40 hover:brightness-110 disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} /> : <BellRing className="h-5 w-5" strokeWidth={2.2} />}
            Ativar notificações
          </button>
          <button type="button" onClick={dismiss} disabled={busy} className="mt-2 min-h-11 w-full rounded-xl text-xs font-semibold text-white/50 hover:bg-white/5 hover:text-white/80 disabled:opacity-50">
            Agora não
          </button>
          <p className="text-center text-[10px] text-white/35">O celular ainda pedirá a confirmação final.</p>
        </div>
      </section>
    </div>
  );
}
