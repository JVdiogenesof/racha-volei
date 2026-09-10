import Link from "next/link";
import { CalendarDays, Megaphone, ArrowRight, ThumbsUp, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
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
  const [{ data: proximoRacha }, { data: avisos }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, location, official_list_open")
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
  ]);

  const { data: myAttendance } = proximoRacha
    ? await supabase
        .from("attendance")
        .select("status")
        .eq("event_id", proximoRacha.id)
        .eq("profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const myStatus = myAttendance?.status;
  const ultimoAviso = avisos?.[0] ?? null;
  const avisoAuthor = ultimoAviso
    ? (ultimoAviso.profiles as unknown as { full_name: string } | null)?.full_name
    : null;
  const avisoIsNew = ultimoAviso
    ? Date.now() - new Date(ultimoAviso.created_at).getTime() < 3 * 24 * 60 * 60 * 1000
    : false;
  const avisoPreview =
    ultimoAviso && ultimoAviso.body.length > 130 ? `${ultimoAviso.body.slice(0, 130).trim()}…` : ultimoAviso?.body;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-brand-navy px-6 py-8 text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">Fala, {profile.full_name.split(" ")[0]}! 🏐</h1>
        <p className="mt-1 text-sm text-white/70">Bem-vindo ao racha da galera.</p>
      </div>

      <section className="rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-brand-navy">
          <CalendarDays className="h-5 w-5 text-brand-purple" strokeWidth={2} />
          <h2 className="font-semibold">Próximo racha</h2>
        </div>
        {proximoRacha ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              {new Date(`${proximoRacha.date}T00:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })}
              {proximoRacha.time ? ` · ${proximoRacha.time.slice(0, 5)}` : ""}
              {proximoRacha.location ? ` · ${proximoRacha.location}` : ""}
            </p>
            <div className="flex items-center gap-2">
              {myStatus === "confirmed" ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  🎉 Confirmado
                </span>
              ) : myStatus === "interested" ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple/10 px-3 py-2 text-sm font-medium text-brand-purple">
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
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Ver lista
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Nenhum racha marcado ainda.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2 text-brand-navy">
            <Megaphone className="h-5 w-5 text-brand-purple" strokeWidth={2} />
            <h2 className="font-semibold">Último aviso</h2>
          </div>
          <Link href="/avisos" className="text-sm text-brand-purple hover:underline">
            Ver todos
          </Link>
        </div>
        {ultimoAviso ? (
          <Link href="/avisos" className="mt-4 block transition hover:bg-gray-50">
            {ultimoAviso.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ultimoAviso.image_url}
                alt={ultimoAviso.title}
                className="h-44 w-full border-y border-gray-100 object-cover"
              />
            )}
            <div className="px-6 py-4">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-brand-navy">{ultimoAviso.title}</p>
                {avisoIsNew && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple">
                    <Sparkles className="h-3 w-3" strokeWidth={2} />
                    Novo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">{avisoPreview}</p>
              <p className="mt-2 text-xs text-gray-400">
                {avisoAuthor} · {relativeDate(ultimoAviso.created_at)}
              </p>
            </div>
          </Link>
        ) : (
          <p className="px-6 py-6 text-sm text-gray-500">Nenhum aviso ainda.</p>
        )}
      </section>
    </div>
  );
}
