"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, MoreVertical, Share, Smartphone, X } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/components/Toast";

const DISMISSED_AT_KEY = "vpa-pwa-install-dismissed-at";
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const OPEN_PWA_INSTALL_EVENT = "vpa:open-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isRunningAsApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function recentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REMIND_AFTER_MS;
}

export function PwaInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [isIos] = useState(() => typeof window !== "undefined" && isIosDevice());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isRunningAsApp());
  const { showToast } = useToast();

  const openManually = useCallback(() => {
    if (isRunningAsApp()) {
      showToast("O aplicativo VPA já está instalado neste aparelho.");
      return;
    }
    setOpen(true);
  }, [showToast]);

  useEffect(() => {
    const runningAsApp = isRunningAsApp();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleInstallAvailable = (rawEvent: Event) => {
      const event = rawEvent as BeforeInstallPromptEvent;
      event.preventDefault();
      setInstallPrompt(event);
      if (!runningAsApp && !recentlyDismissed()) setOpen(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setOpen(false);
      window.localStorage.removeItem(DISMISSED_AT_KEY);
      showToast("VPA instalado! Agora ele está na sua tela inicial.");
    };

    const handleManualOpen = () => openManually();

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener(OPEN_PWA_INSTALL_EVENT, handleManualOpen);

    let automaticTimer: number | undefined;
    if (isIos && !runningAsApp && !recentlyDismissed()) {
      automaticTimer = window.setTimeout(() => setOpen(true), 1_200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener(OPEN_PWA_INSTALL_EVENT, handleManualOpen);
      if (automaticTimer) window.clearTimeout(automaticTimer);
    };
  }, [isIos, openManually, showToast]);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setOpen(false);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") {
      setOpen(false);
      return;
    }
    dismiss();
  }

  if (!open || installed) return null;

  const canInstallDirectly = installPrompt !== null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#08051a]/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#18103b] shadow-2xl shadow-black/60 animate-pwa-sheet-in"
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.38),transparent_65%)]" />
        <button type="button" onClick={dismiss} aria-label="Fechar aviso de instalação" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/20 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-5 pt-6 sm:p-6">
          <div className="flex items-center gap-4 pr-8">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-purple-950/40">
              <Image src="/pwa-icon-192.png" alt="Vôlei por Amor" width={64} height={64} className="h-full w-full object-cover" priority />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200/70">Acesso mais rápido</p>
              <h2 id="pwa-install-title" className="mt-1 text-xl font-black leading-tight text-white">Tenha o VPA como aplicativo</h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-white/70">Coloque o VPA na tela inicial do celular e entre com um toque, com visual de aplicativo e sem procurar o link novamente.</p>

          {canInstallDirectly ? (
            <button type="button" onClick={install} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/40 hover:brightness-110">
              <Download className="h-5 w-5" />
              Instalar agora
            </button>
          ) : isIos ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-purple-200">No iPhone, são 3 toques</p>
              <ol className="space-y-3 text-sm text-white/85">
                <InstallStep number="1" icon={Share}>Toque em <strong>Compartilhar</strong> no Safari.</InstallStep>
                <InstallStep number="2" icon={Smartphone}>Escolha <strong>Adicionar à Tela de Início</strong>.</InstallStep>
                <InstallStep number="3" icon={Check}>Ative <strong>Abrir como App</strong> e toque em Adicionar.</InstallStep>
              </ol>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-sm leading-6 text-white/80"><MoreVertical className="mr-2 inline h-4 w-4 text-purple-200" />Abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
            </div>
          )}

          <button type="button" onClick={dismiss} className="mt-3 min-h-11 w-full rounded-xl text-xs font-semibold text-white/50 hover:bg-white/5 hover:text-white/80">
            {canInstallDirectly ? "Agora não" : "Entendi"}
          </button>
          <p className="text-center text-[10px] text-white/35">Leva menos de 20 segundos.</p>
        </div>
      </section>
    </div>
  );
}

function InstallStep({ number, icon: Icon, children }: { number: string; icon: typeof Share; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-400/15 text-purple-200"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1 leading-5"><span className="sr-only">Passo {number}: </span>{children}</span>
    </li>
  );
}
