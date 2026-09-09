import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Users2, Trophy, Wallet, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function RachaHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, date, time, location, num_teams, price_per_player, status")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  const { count: confirmedCount } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("status", "confirmed");

  const { data: myAttendance } = await supabase
    .from("attendance")
    .select("status")
    .eq("event_id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          Racha de {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {event.location ?? "Local a definir"}
          {event.time ? ` · ${event.time.slice(0, 5)}` : ""} · {event.num_teams} times
          {event.price_per_player ? ` · R$ ${Number(event.price_per_player).toFixed(2)} por jogador` : ""}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {confirmedCount ?? 0} confirmados · você está{" "}
          <strong>{myAttendance?.status === "confirmed" ? "confirmado" : "de fora"}</strong>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HubCard
          href={`/racha/${id}/confirmar`}
          icon={CalendarCheck}
          title="Confirmar presença"
          description="Diga se você vai jogar."
        />
        <HubCard
          href={`/racha/${id}/times`}
          icon={Users2}
          title="Times"
          description="Veja ou gere os times balanceados."
        />
        <HubCard href={`/racha/${id}/mvp`} icon={Trophy} title="MVP" description="Vote em quem jogou melhor." />
        {profile.is_organizer && (
          <HubCard
            href={`/racha/${id}/pagamentos`}
            icon={Wallet}
            title="Pagamentos"
            description="Controle de quem já pagou."
          />
        )}
      </div>
    </div>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-gray-200 p-5 transition hover:border-brand-purple hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple transition group-hover:bg-brand-purple group-hover:text-white">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <p className="font-semibold text-brand-navy">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}
