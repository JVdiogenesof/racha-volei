import Link from "next/link";
import { CalendarDays, Clock, MapPin, Megaphone, ArrowRight, ThumbsUp, Sparkles, ChevronRight, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { BirthdaysCard } from "@/components/BirthdaysCard";
import { RachaLevelBadge } from "@/components/RachaLevelBadge";
import { getRachaLevel } from "@/lib/rachaLevel";
import { setAttendance } from "./racha/[id]/confirmar/actions";

function relativeDate(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "agora há pouco";
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "há 1 dia";
  if (diffDays < 7) return `há ${diffDays} dias`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: proximoRacha }, { data: avisos }, { data: birthdayProfiles }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, location, status, official_list_open")
      .gte("date", today)
      .neq("status", "finished")
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("announcements")
      .select("id, title, body, image_url, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("profiles").select("id, full_name, birthdate, avatar_url").eq("status", "approved"),
  ]);

  const { data: myAttendance } = proximoRacha
    ? await supabase
        .from("attendance")
        .select("status")
        .eq("event_id", proximoRacha.id)
        .eq("profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const rachaLevel =
    proximoRacha?.official_list_open ? await getRachaLevel(supabase, proximoRacha.id) : null;
  const isInProgress = proximoRacha?.status === "in_progress";
  const myStatus = myAttendance?.status;
  const ultimoAviso = avisos?.[0] ?? null;
  const avisoAuthor = ultimoAviso
    ? (ultimoAviso.profiles as unknown as { full_name: string } | null)?.full_name
    : null;
  const avisoIsNew = ultimoAviso
    ? Date.now() - new Date(ultimoAviso.created_at).getTime() < 3 * 24 * 60 * 60 * 1000
    : false;
  const avisoPreview =
    ultimoAviso && ultimoAviso.body.length > 100 ? `${ultimoAviso.body.slice(0, 100).trim()}…` : ultimoAviso?.body;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Fala, {profile.full_name.split(" ")[0]}! 🏐</h1>
        <p className="mt-1 text-sm text-white/60">Bem-vindo ao racha da galera.</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-light to-[#241a52] p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rotate-[-8deg] object-contain opacity-25 sm:h-48 sm:w-48"
        />
        <div className="relative max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Vôlei por amor</p>
          <p className="mt-1 text-xl font-bold leading-snug sm:text-2xl">
            Mais que um jogo, <span className="text-purple-300">é a nossa resenha!</span>
          </p>
          <p className="mt-2 text-sm text-white/60">
            Aqui a gente joga, se diverte e mantém a amizade em quadra.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-purple/25 text-purple-200">
              <CalendarDays className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <h2 className="font-semibold">Próximo racha</h2>
          </div>
          <div className="flex items-center gap-2">
            {isInProgress && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-400/15 px-3 py-1 text-xs font-medium text-red-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                Rolando agora
              </span>
            )}
            {proximoRacha && myStatus === "confirmed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-400/15 px-3 py-1 text-xs font-medium text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Confirmado
              </span>
            )}
          </div>
        </div>

        {proximoRacha ? (
          <>
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-white/80">
              <p className="flex items-center gap-2.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} />
                {new Date(`${proximoRacha.date}T00:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </p>
              {proximoRacha.time && (
                <p className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} />
                  {proximoRacha.time.slice(0, 5)}
                </p>
              )}
              {proximoRacha.location && (
                <p className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} />
                  {proximoRacha.location}
                </p>
              )}
              {rachaLevel !== null && (
                <div className="flex items-center gap-2.5">
                  <Star className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} />
                  <RachaLevelBadge level={rachaLevel} />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {myStatus === "confirmed" ? null : myStatus === "interested" ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple/20 px-3 py-2 text-sm font-medium text-purple-200">
                  <ThumbsUp className="h-4 w-4" strokeWidth={2} />
                  Interesse registrado
                </span>
              ) : (
                <ActionForm action={setAttendance} successMessage="Interesse registrado!">
                  <input type="hidden" name="eventId" value={proximoRacha.id} />
                  <input type="hidden" name="status" value="interested" />
                  <button className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark">
                    <ThumbsUp className="h-4 w-4" strokeWidth={2} />
                    Tenho interesse
                  </button>
                </ActionForm>
              )}
              <Link
                href={`/racha/${proximoRacha.id}/confirmar`}
                className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Ver lista
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/50">Nenhum racha marcado ainda.</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-300" strokeWidth={2} />
            <h2 className="font-semibold">Último aviso</h2>
          </div>
          <Link href="/avisos" className="inline-flex items-center gap-1 text-sm text-purple-300 hover:underline">
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>

        {ultimoAviso ? (
          <Link
            href="/avisos"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
          >
            {ultimoAviso.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ultimoAviso.image_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-purple/20 text-purple-200">
                <Megaphone className="h-6 w-6" strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-white">{ultimoAviso.title}</p>
                {avisoIsNew && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-purple/25 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                    <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
                    Novo
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-white/60">{avisoPreview}</p>
              <p className="mt-1 text-xs text-white/40">
                {avisoAuthor} · {relativeDate(ultimoAviso.created_at)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2} />
          </Link>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
            Nenhum aviso ainda.
          </p>
        )}
      </section>

      <BirthdaysCard profiles={birthdayProfiles ?? []} />
    </div>
  );
}
