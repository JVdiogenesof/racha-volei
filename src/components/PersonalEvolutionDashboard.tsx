"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Crown,
  History,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { EvolutionConnection, EvolutionStatus, PersonalEvolution } from "@/lib/evolution";

const STATUS_INFO: Record<EvolutionStatus, { label: string; icon: typeof CalendarCheck; className: string }> = {
  confirmed: { label: "Confirmado", icon: CalendarCheck, className: "text-emerald-300" },
  interested: { label: "Interesse marcado", icon: Sparkles, className: "text-purple-300" },
  declined: { label: "Não participou", icon: X, className: "text-white/40" },
  participated: { label: "Participou", icon: CalendarCheck, className: "text-emerald-300" },
};

function ConnectionsCard({
  title,
  subtitle,
  empty,
  people,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  empty: string;
  people: EvolutionConnection[];
  icon: typeof UsersRound;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-400/10 text-purple-200">
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="text-[11px] text-white/45">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-white/[0.07]">
        {!people.length && <p className="px-4 py-5 text-center text-xs text-white/45">{empty}</p>}
        {people.slice(0, 5).map((person, index) => (
          <div key={person.profileId} className="flex items-center gap-3 px-4 py-3">
            <span className="w-4 text-center text-[10px] font-bold text-white/35">{index + 1}</span>
            <Avatar src={person.avatarUrl} name={person.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{person.fullName}</p>
              <p className="text-[11px] text-white/45">
                {person.events} {person.events === 1 ? "racha" : "rachas"}
              </p>
            </div>
            <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold text-purple-100">
              {person.confrontations}x
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PersonalEvolutionDashboard({ report }: { report: PersonalEvolution }) {
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const { totals } = report;
  const percentage = totals.percentage ?? 0;
  const recentMonths = report.months.slice(-6);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          aria-pressed={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
            activeTab === "overview" ? "bg-purple-500 text-white shadow-lg shadow-purple-950/30" : "text-white/55 hover:text-white"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Visão geral
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
            activeTab === "history" ? "bg-purple-500 text-white shadow-lg shadow-purple-950/30" : "text-white/55 hover:text-white"
          }`}
        >
          <History className="h-4 w-4" />
          Racha a racha
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="mt-4 space-y-4">
          <section className="relative overflow-hidden rounded-3xl border border-purple-300/15 bg-gradient-to-br from-purple-600/30 via-purple-950/35 to-white/[0.035] p-5">
            <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl" />
            <div className="relative flex items-center gap-5">
              <div
                className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                style={{ background: `conic-gradient(#a855f7 ${percentage * 3.6}deg, rgba(255,255,255,.09) 0deg)` }}
              >
                <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-[#17102b] text-center">
                  <div>
                    <p className="text-2xl font-black text-white">{totals.percentage === null ? "—" : `${totals.percentage}%`}</p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-purple-200/65">aproveitamento</p>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/65">Seu momento</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-white">
                  {totals.matches
                    ? `${totals.performanceWins} vitórias em ${totals.matches} confrontos`
                    : "Seu histórico começa aqui"}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  {totals.matches
                    ? `${totals.losses} derrotas registradas nos confrontos normais.`
                    : "Quando os confrontos forem registrados, sua evolução aparecerá automaticamente."}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Presenças", value: totals.attendance, icon: CalendarCheck, color: "text-sky-300" },
              { label: "Vitórias", value: totals.wins, icon: Crown, color: "text-amber-300" },
              { label: "Destaques", value: totals.highlights, icon: Trophy, color: "text-purple-300" },
              { label: "Confrontos", value: totals.matches, icon: Target, color: "text-emerald-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
                <item.icon className={`h-4.5 w-4.5 ${item.color}`} strokeWidth={2} />
                <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-white/45">{item.label}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Evolução mensal</h2>
                <p className="mt-0.5 text-[11px] text-white/45">Seus últimos meses com rachas encerrados</p>
              </div>
              <Medal className="h-5 w-5 text-purple-300" />
            </div>
            {!recentMonths.length ? (
              <p className="mt-5 text-center text-xs text-white/45">Ainda não há meses concluídos para comparar.</p>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {recentMonths.map((month) => (
                  <div key={month.monthKey} className="flex min-w-0 flex-col items-center">
                    <div className="flex h-24 w-full items-end justify-center rounded-xl bg-white/[0.035] px-2 pt-2">
                      <div
                        className="w-full max-w-9 rounded-t-lg bg-gradient-to-t from-purple-700 to-fuchsia-400 transition-all"
                        style={{ height: `${Math.max(month.percentage ?? 0, month.matches ? 10 : 4)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-black text-white">{month.percentage === null ? "—" : `${month.percentage}%`}</p>
                    <p className="truncate text-[10px] capitalize text-white/45">{month.monthLabel}</p>
                    <p className="mt-0.5 text-[9px] text-white/35">{month.wins}V · {month.losses}D</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <ConnectionsCard
              title="Com quem você mais joga"
              subtitle="Companheiros nos confrontos"
              empty="Seus companheiros aparecerão após os confrontos."
              people={report.teammates}
              icon={UsersRound}
            />
            <ConnectionsCard
              title="Quem você mais enfrentou"
              subtitle="Adversários nos confrontos"
              empty="Seus adversários aparecerão após os confrontos."
              people={report.opponents}
              icon={ShieldCheck}
            />
          </div>

          <p className="px-2 text-center text-[10px] leading-relaxed text-white/35">
            O aproveitamento e as conexões usam confrontos normais com vencedor e perdedor registrados. As vitórias de pré-torneios continuam no total de vitórias.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {!report.entries.length && (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
              <History className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-3 text-sm font-semibold text-white/60">Seu histórico ainda está vazio.</p>
            </div>
          )}
          {report.entries.map((entry) => {
            const statusInfo = STATUS_INFO[entry.status];
            const StatusIcon = statusInfo.icon;
            const eventDate = new Date(`${entry.date}T12:00:00`);
            return (
              <article key={entry.eventId} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]">
                <div className="flex items-center gap-3 p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-400/10 text-purple-200">
                    <span className="text-center leading-none">
                      <strong className="block text-base font-black">{eventDate.toLocaleDateString("pt-BR", { day: "2-digit" })}</strong>
                      <small className="mt-0.5 block text-[9px] font-bold uppercase text-purple-200/65">
                        {eventDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                      </small>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-white">{entry.location || "Racha VPA"}</p>
                      {entry.isPreTournament && (
                        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-200">Especial</span>
                      )}
                    </div>
                    <p className={`mt-1 flex items-center gap-1 text-[11px] ${statusInfo.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {entry.wasPresent ? "Presença registrada" : statusInfo.label}
                    </p>
                  </div>
                </div>
                {(entry.wins > 0 || entry.matches > 0 || entry.wasDestaque) && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3">
                    {entry.wins > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                        <Crown className="h-3 w-3" /> {entry.wins}V
                      </span>
                    )}
                    {entry.losses > 0 && (
                      <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-[11px] font-bold text-rose-200">{entry.losses}D</span>
                    )}
                    {entry.percentage !== null && (
                      <span className="rounded-full bg-purple-400/10 px-2.5 py-1 text-[11px] font-bold text-purple-200">{entry.percentage}%</span>
                    )}
                    {entry.wasDestaque && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                        <Trophy className="h-3 w-3" /> Destaque
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
