import Link from "next/link";
import { CalendarDays, Megaphone, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AnnouncementCard } from "@/components/AnnouncementCard";

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
      .limit(2),
  ]);

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
            <Link
              href={`/racha/${proximoRacha.id}/confirmar`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
            >
              {proximoRacha.official_list_open ? "Ver lista de confirmados" : "Tenho interesse"}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Nenhum racha marcado ainda.</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-navy">
            <Megaphone className="h-5 w-5 text-brand-purple" strokeWidth={2} />
            <h2 className="font-semibold">Últimos avisos</h2>
          </div>
          <Link href="/avisos" className="text-sm text-brand-purple hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="mt-3 space-y-4">
          {avisos?.map((a) => {
            const author = (a.profiles as unknown as { full_name: string } | null)?.full_name;
            return <AnnouncementCard key={a.id} announcement={{ ...a, author }} />;
          })}
          {!avisos?.length && <p className="text-sm text-gray-500">Nenhum aviso ainda.</p>}
        </div>
      </section>
    </div>
  );
}
