"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, HandHeart, Heart, Loader2, PartyPopper, Target, X } from "lucide-react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PRESETS = [5, 10, 20, 50];
const POLL_MS = 5_000;
// O código vale 30 minutos; continua conferindo mais 5 minutos depois disso.
const LATE_CHECK_MS = 5 * 60 * 1000;

type PixData = {
  intentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  amount: number;
  reservationExpiresAt: string;
  serverNow: string;
};

type Phase =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "paying"; pix: PixData; clockOffset: number }
  | { kind: "paid"; amount: number }
  | { kind: "error"; message: string };

function parseAmount(raw: string) {
  const cleaned = raw.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
    return copied;
  }
}

export function DonationCard({
  campaignId,
  title,
  description,
  total,
  goal,
  featured = false,
}: {
  campaignId: string;
  title: string;
  description: string | null;
  total: number;
  goal: number | null;
  featured?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(10);
  const [custom, setCustom] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const router = useRouter();

  const customValue = custom.trim() ? parseAmount(custom) : null;
  const amount = customValue ?? selected;
  const amountError =
    customValue !== null && (Number.isNaN(customValue) || customValue < 1)
      ? "O valor mínimo é R$ 1,00."
      : customValue !== null && customValue > 5000
        ? "O valor máximo por Pix é R$ 5.000,00."
        : null;
  const canPay = amount !== null && !amountError && !Number.isNaN(amount);
  const progress = goal ? Math.min(100, Math.round((total / goal) * 100)) : null;

  async function start() {
    if (!canPay || busy.current || amount === null) return;
    busy.current = true;
    setNotice(null);
    setCopied(false);
    setPhase({ kind: "generating" });
    try {
      const response = await fetch("/api/payments/doacao/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, amount }),
      });
      const payload = (await response.json().catch(() => null)) as (PixData & { error?: string }) | null;
      if (!response.ok || !payload?.qrCode) {
        setPhase({ kind: "error", message: payload?.error || "Não conseguimos gerar o Pix agora. Tente de novo." });
        return;
      }
      setNow(Date.now());
      setPhase({ kind: "paying", pix: payload, clockOffset: new Date(payload.serverNow).getTime() - Date.now() });
    } catch {
      setPhase({ kind: "error", message: "A conexão falhou enquanto gerávamos o Pix. Tente de novo." });
    } finally {
      busy.current = false;
    }
  }

  const pix = phase.kind === "paying" ? phase.pix : null;
  const clockOffset = phase.kind === "paying" ? phase.clockOffset : 0;

  const check = useCallback(async () => {
    if (!pix) return false;
    try {
      const response = await fetch("/api/payments/doacao/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: pix.intentId }),
      });
      const payload = (await response.json().catch(() => null)) as { paid?: boolean } | null;
      if (payload?.paid) {
        setPhase({ kind: "paid", amount: pix.amount });
        router.refresh();
        return true;
      }
    } catch {
      // tenta de novo no próximo ciclo
    }
    return false;
  }, [pix, router]);

  useEffect(() => {
    if (!pix) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const giveUpAt = new Date(pix.reservationExpiresAt).getTime() + LATE_CHECK_MS;
    let stopped = false;
    let timer: number | undefined;
    const run = async () => {
      if (stopped) return;
      const done = document.hidden ? false : await check();
      if (!done && !stopped && Date.now() + clockOffset < giveUpAt) timer = window.setTimeout(run, POLL_MS);
    };
    timer = window.setTimeout(run, POLL_MS);
    const onReturn = () => {
      if (document.hidden || stopped) return;
      window.clearTimeout(timer);
      void run();
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      stopped = true;
      window.clearInterval(tick);
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [pix, clockOffset, check]);

  async function checkNow() {
    setChecking(true);
    setNotice(null);
    const done = await check();
    setChecking(false);
    if (!done) setNotice("Ainda não recebemos o pagamento. Se acabou de pagar, ele costuma chegar em alguns segundos.");
  }

  const secondsLeft = pix ? Math.max(0, Math.ceil((new Date(pix.reservationExpiresAt).getTime() - (now + clockOffset)) / 1000)) : 0;
  const sheetOpen = phase.kind !== "idle";

  return (
    <section
      className={`rounded-2xl border p-4 sm:p-5 ${featured ? "border-pink-300/35 bg-gradient-to-br from-pink-500/15 via-purple-500/10 to-transparent" : "border-white/10 bg-white/[0.035]"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${featured ? "bg-pink-400/20 text-pink-200" : "bg-purple-500/15 text-purple-200"}`}>
          {featured ? <HandHeart className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-tight text-white text-balance">{title}</h2>
          {description && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/70">{description}</p>}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-black/25 p-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Arrecadado</p>
            <p className="text-2xl font-black text-emerald-300">{money.format(total)}</p>
          </div>
          {goal && (
            <p className="flex items-center gap-1 pb-1 text-xs font-semibold text-white/60">
              <Target className="h-3.5 w-3.5" /> Meta {money.format(goal)}
            </p>
          )}
        </div>
        {progress !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <p className="mt-4 text-sm font-bold text-white">Quanto você quer dar?</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {PRESETS.map((value) => {
          const active = !custom.trim() && selected === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSelected(value);
                setCustom("");
              }}
              aria-pressed={active}
              className={`min-h-11 rounded-xl border text-sm font-bold transition ${active ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10"}`}
            >
              R$ {value}
            </button>
          );
        })}
      </div>
      <label className="mt-2 block text-xs font-semibold text-white/60">
        Outro valor
        <div className="mt-1 flex min-h-11 items-center rounded-xl border border-white/15 bg-[#21123d] px-3 focus-within:border-emerald-300">
          <span className="text-sm font-bold text-white/60">R$</span>
          <input
            inputMode="decimal"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="0,00"
            className="ml-2 w-full bg-transparent text-base font-bold text-white outline-none placeholder:text-white/30"
          />
        </div>
      </label>
      {amountError && <p className="mt-1 text-xs font-semibold text-amber-300">{amountError}</p>}

      <button
        type="button"
        onClick={() => void start()}
        disabled={!canPay || phase.kind === "generating"}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {phase.kind === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
        {canPay && amount !== null ? `Apoiar com ${money.format(amount)} no Pix` : "Escolha o valor"}
      </button>

      {sheetOpen &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="donation-sheet-title">
            <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#170a2e] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-pink-200">{title}</p>
                <button type="button" onClick={() => setPhase({ kind: "idle" })} aria-label="Fechar" className="-m-2 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {phase.kind === "generating" && (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
                  <h3 id="donation-sheet-title" className="mt-4 text-xl font-black text-white">Gerando seu Pix...</h3>
                </div>
              )}

              {phase.kind === "error" && (
                <div className="py-6 text-center">
                  <h3 id="donation-sheet-title" className="text-xl font-black text-white">Não deu certo</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{phase.message}</p>
                  <button type="button" onClick={() => void start()} className="mt-4 min-h-11 w-full rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400">
                    Tentar de novo
                  </button>
                </div>
              )}

              {phase.kind === "paid" && (
                <div className="py-6 text-center">
                  <PartyPopper className="mx-auto h-10 w-10 text-pink-300" />
                  <h3 id="donation-sheet-title" className="mt-3 text-2xl font-black text-white">Muito obrigado!</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">Seu apoio de {money.format(phase.amount)} chegou e já entrou no total da campanha. O VPA agradece! 💜</p>
                  <button type="button" onClick={() => setPhase({ kind: "idle" })} className="mt-5 min-h-11 w-full rounded-xl bg-white/10 font-bold text-white hover:bg-white/15">
                    Fechar
                  </button>
                </div>
              )}

              {phase.kind === "paying" && (
                <div className="mt-2">
                  <h3 id="donation-sheet-title" className="text-xl font-black text-white">Pague {money.format(phase.pix.amount)} no Pix</h3>
                  <p className="mt-1 text-sm text-white/65">
                    {secondsLeft > 0
                      ? `Este código vale por ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}.`
                      : "O prazo deste código terminou. Se ainda não pagou, feche e gere outro."}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/png;base64,${phase.pix.qrCodeBase64}`} alt="QR Code do Pix" className="mx-auto mt-4 h-52 w-52 rounded-xl bg-white p-2" />
                  <button
                    type="button"
                    onClick={async () => setCopied(await copyText(phase.pix.qrCode))}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Código copiado! Cole no app do banco" : "Copiar código Pix (copia e cola)"}
                  </button>
                  <a href={phase.pix.ticketUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-semibold text-white/80 hover:bg-white/5">
                    <ExternalLink className="h-4 w-4" /> Abrir no Mercado Pago
                  </a>
                  <p className="mt-3 text-xs leading-relaxed text-white/55">O pagamento é reconhecido sozinho em poucos segundos. Não precisa mandar comprovante.</p>
                  <button type="button" onClick={() => void checkNow()} disabled={checking} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-60">
                    {checking && <Loader2 className="h-4 w-4 animate-spin" />} Já paguei
                  </button>
                  {notice && <p className="mt-2 text-xs leading-relaxed text-amber-200">{notice}</p>}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
