import Link from "next/link";
import { CalendarDays, Megaphone, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: proximoRacha } = await supabase
    .from("events")
    .select("id, date, time, location")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: avisos } = await supabase
    .from("announcements")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

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
              Confirmar presença
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
        <ul className="mt-3 space-y-2">
          {avisos?.map((a) => (
            <li key={a.id} className="text-sm text-gray-700">
              {a.title}
            </li>
          ))}
          {!avisos?.length && <p className="text-sm text-gray-500">Nenhum aviso ainda.</p>}
        </ul>
      </section>
    </div>
  );
}
