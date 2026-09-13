"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import { savePushSubscription, deletePushSubscription } from "@/app/(app)/perfil/actions";

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushOptIn() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        setStatus(subscription ? "on" : "off");
      } catch {
        setStatus("off");
      }
    }
    check();
  }, []);

  async function handleActivate() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      showToast("Notificações ainda não configuradas nesse ambiente.");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setStatus("on");
      showToast("Notificações ativadas!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não deu pra ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
      showToast("Notificações desativadas.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não deu pra desativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return <p className="text-sm text-white/60">Seu navegador não tem suporte a notificações.</p>;
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-white/60">
        Notificações bloqueadas pelo navegador. Ative pelas configurações do site (ícone de cadeado na barra de endereço) pra receber avisos aqui.
      </p>
    );
  }

  if (status === "on") {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-green-300">
          <Bell className="h-4 w-4" strokeWidth={2} />
          Notificações ativadas
        </span>
        <button
          type="button"
          onClick={handleDeactivate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <BellOff className="h-4 w-4" strokeWidth={2} />}
          Desativar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleActivate}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Bell className="h-4 w-4" strokeWidth={2} />}
      Ativar notificações
    </button>
  );
}
