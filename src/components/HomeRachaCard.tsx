import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock, MapPin, Medal, ThumbsUp, Trophy, Users, Zap } from "lucide-react";
import { InterestButton } from "./InterestButton";
import { ConfirmedCounter } from "./ConfirmedCounter";
import { BatchStatus } from "./BatchStatus";
import { RachaLevelBadge } from "./RachaLevelBadge";
import { RegistrationOpensNotice } from "./RegistrationOpensNotice";
import { joinMode, type JoinStatus } from "./RachaHowToJoin";
import { formatBatchOpening, isRegistrationOpen } from "@/lib/registrationSchedule";
import { teamFormatLabel } from "@/lib/rachaFormat";
import { formatRegistrationOpening, rachaDayParts } from "@/lib/rachaDates";

export type HomeRachaEvent = {
  id: string;
  date: string;
  time: string | null;
  location: string | null;
  team_size: number;
  status: string;
  official_list_open: boolean;
  price_per_player: string | number | null;
  pix_payment_enabled: boolean;
  max_players: number | null;
  is_pre_torneio: boolean;
  is_mini_torneio: boolean;
  registration_opens_at: string | null;
  first_batch_spots: number | null;
  second_batch_opens_at: string | null;
};

const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-black text-[#4c1d95] shadow-lg shadow-black/20 hover:bg-purple-50";

/**
 * Card de um racha na tela de início. Os dois rachas marcados usam este mesmo
 * card: o dia aparece grande e claro, e o horário de abertura das inscrições é
 * só um aviso (sem contagem regressiva).
 */
export function HomeRachaCard({
  event,
  myStatus,
  paid,
  confirmedCount,
  setterConfirmedCount,
  rachaLevel,
  canRespond,
  isPaymentExempt,
  isFull,
  isOrganizer,
  action,
}: {
  event: HomeRachaEvent;
  myStatus: string | undefined;
  paid: boolean;
  confirmedCount: number;
  setterConfirmedCount: number;
  rachaLevel: number | null;
  canRespond: boolean;
  isPaymentExempt: boolean;
  isFull: boolean;
  isOrganizer: boolean;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const registrationOpen = isRegistrationOpen(event.registration_opens_at, event.official_list_open);
  const isInProgress = event.status === "in_progress";
  const preTorneio = event.is_pre_torneio;
  const day = rachaDayParts(event.date);
  const price = event.price_per_player ? Number(event.price_per_player) : null;
  const mode = joinMode({ price, pixAuto: event.pix_payment_enabled, exempt: isPaymentExempt });
  const status: JoinStatus = myStatus === "confirmed" || myStatus === "interested" || myStatus === "declined" ? myStatus : "none";
  const confirmUrl = `/racha/${event.id}/confirmar`;
  // Racha com Pix automático: esses botões já abrem o pagamento na tela da lista.
  const payUrl = `${confirmUrl}?pagar=1`;

  const phase = isInProgress
    ? { label: "Rolando agora", className: "bg-red-400/25 text-red-100", dot: "bg-red-300" }
    : registrationOpen
      ? { label: "Inscrições abertas", className: "bg-emerald-400/25 text-emerald-100", dot: "bg-emerald-300" }
      : event.registration_opens_at
        ? { label: "Inscrições em breve", className: "bg-amber-400/25 text-amber-100", dot: "bg-amber-300" }
        : null;

  return (
    <section className={`copa-frame rounded-3xl ${preTorneio ? "theme-gold" : ""}`} aria-label={`Racha de ${day.weekdayLong}, ${day.dayMonthLong}`}>
      <div className={`copa-hero ${preTorneio ? "theme-gold" : "theme-ranking"} copa-shine rounded-[22px]`}>
        <span aria-hidden className="copa-orb -left-10 -top-12 h-40 w-40 bg-fuchsia-400" />
        <span aria-hidden className="copa-orb copa-orb-slow -bottom-16 -right-10 h-44 w-44 bg-violet-500" />

        <div className="relative z-10 space-y-2 p-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 overflow-hidden rounded-2xl bg-white text-center text-[#3b1a7a] shadow-lg shadow-black/25">
              <p className="bg-fuchsia-500 px-3.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">{day.monthShort}</p>
              <p className="px-3.5 pt-0.5 text-[32px] font-black leading-none">{day.day}</p>
              <p className="px-3.5 pb-1.5 text-[10px] font-black uppercase tracking-wide">{day.weekdayShort}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="copa-title break-words text-[24px] font-black uppercase leading-none">{day.weekdayLong}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] font-bold text-white">
                {event.time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-purple-100" strokeWidth={2.5} />
                    {event.time.slice(0, 5)}
                  </span>
                )}
                {event.location && (
                  <span className="inline-flex items-start gap-1 font-medium text-purple-50">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-100" strokeWidth={2.5} />
                    <span className="break-words">{event.location}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {phase && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${phase.className}`}>
                <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${phase.dot}`} /> {phase.label}
              </span>
            )}
            {preTorneio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950">
                <Trophy className="h-3 w-3" strokeWidth={2.75} />
                Pré-torneio
              </span>
            )}
            {event.is_mini_torneio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-100">
                <Medal className="h-3 w-3" />
                Mini torneio
              </span>
            )}
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">{teamFormatLabel(event.team_size)}</span>
            {myStatus === "confirmed" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.75} />
                Você está na lista
              </span>
            )}
            {rachaLevel !== null && <RachaLevelBadge level={rachaLevel} />}
          </div>

          {!registrationOpen && event.registration_opens_at ? (
            <>
              <RegistrationOpensNotice opensAt={event.registration_opens_at} label={formatRegistrationOpening(event.registration_opens_at)} />
              <Link
                href={`/racha/${event.id}`}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-white/15 px-3 text-sm font-bold text-white hover:bg-white/20"
              >
                Ver detalhes do racha
                <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </>
          ) : (
            <>
              <BatchStatus maxPlayers={event.max_players} firstBatchSpots={event.first_batch_spots} secondBatchOpensAt={event.second_batch_opens_at} registrationOpensAt={event.registration_opens_at} confirmedCount={confirmedCount} setterCount={setterConfirmedCount} compact />
              <div className="rounded-xl border border-white/15 bg-black/25 p-2.5">
                <ConfirmedCounter
                  eventId={event.id}
                  maxPlayers={event.max_players}
                  firstBatchSpots={event.first_batch_spots}
                  secondBatchOpensAt={event.second_batch_opens_at}
                  initialConfirmedCount={confirmedCount}
                  initialSetterCount={setterConfirmedCount}
                  compact
                  showFullCapacity={isOrganizer}
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                {!canRespond ? (
                  <Link href={confirmUrl} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/15 px-3 text-center text-sm font-bold text-amber-100 hover:bg-amber-400/20">
                    <Users className="h-4 w-4" strokeWidth={2.25} />
                    Acompanhar
                  </Link>
                ) : status === "confirmed" && mode !== "free" && !paid ? (
                  <Link href={mode === "pix" ? payUrl : confirmUrl} className={PRIMARY_BUTTON}>
                    <ThumbsUp className="h-4 w-4" strokeWidth={2.5} />
                    {mode === "pix" ? "Pagar o Pix da vaga" : "Ver como pagar"}
                  </Link>
                ) : status === "confirmed" ? (
                  <Link href={`/racha/${event.id}`} className={PRIMARY_BUTTON}>
                    <Zap className="h-4 w-4" strokeWidth={2.75} />
                    Abrir racha
                  </Link>
                ) : status === "interested" ? (
                  <Link href={mode === "pix" && !isFull ? payUrl : confirmUrl} className={PRIMARY_BUTTON}>
                    <ThumbsUp className="h-4 w-4" strokeWidth={2.5} />
                    {/* No Pix automático, quem só está interessado ainda não pagou esta vaga, mesmo com um pagamento antigo de quando desistiu. */}
                    {mode === "pix" ? "Pagar o Pix da vaga" : mode === "manual" && !paid ? "Ver como pagar" : "Ver minha vaga"}
                  </Link>
                ) : isPaymentExempt ? (
                  <Link href={confirmUrl} className={PRIMARY_BUTTON}>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                    Entrar na lista
                  </Link>
                ) : (
                  <InterestButton
                    eventId={event.id}
                    price={price}
                    isFull={isFull}
                    secondBatchOpensLabel={isFull && event.first_batch_spots != null && event.second_batch_opens_at ? formatBatchOpening(event.second_batch_opens_at) : null}
                    pixPaymentEnabled={event.pix_payment_enabled}
                    action={action}
                    className={`${PRIMARY_BUTTON} w-full disabled:opacity-60`}
                  />
                )}
                <Link href={confirmUrl} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-white/15 px-4 text-center text-sm font-bold text-white hover:bg-white/20">
                  Ver lista
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
