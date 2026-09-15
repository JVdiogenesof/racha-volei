import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { AddReservedPlayerForm } from "@/components/AddReservedPlayerForm";
import { RemoveReservedPlayerButton } from "@/components/RemoveReservedPlayerButton";
import { ClearReservedListButton } from "@/components/ClearReservedListButton";
import { addReservedPlayer, removeReservedPlayer, clearReservedList } from "./actions";

export default async function TorneiosVpaPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: reserved }, { data: approvedProfiles }] = await Promise.all([
    supabase
      .from("tournament_reserved_players")
      .select(
        "profile_id, added_at, source_event_id, profiles!tournament_reserved_players_profile_id_profiles_id_fk(full_name, avatar_url), events!tournament_reserved_players_source_event_id_events_id_fk(date)",
      )
      .order("added_at", { ascending: true }),
    profile.is_organizer
      ? supabase.from("profiles").select("id, full_name").eq("status", "approved").order("full_name")
      : Promise.resolve({ data: null }),
  ]);

  const reservedIds = new Set((reserved ?? []).map((r) => r.profile_id));
  const addOptions = (approvedProfiles ?? [])
    .filter((p) => !reservedIds.has(p.id))
    .map((p) => ({ id: p.id, fullName: p.full_name }));

  // Cada racha pré-torneio só reserva vaga pro time campeão de uma vez, então
  // agrupar por source_event_id já mostra certinho "esse time venceu esse
  // pré-torneio" -- não precisa guardar o team_id separado. Reservas
  // adicionadas à mão (sem racha de origem) ficam num grupo à parte, por
  // último.
  type ReservedRow = {
    profile_id: string;
    source_event_id: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
    events: { date: string } | null;
  };
  type Group = { key: string; eventId: string | null; date: string | null; members: ReservedRow[] };

  const groupByKey = new Map<string, Group>();
  const groups: Group[] = [];
  for (const row of (reserved ?? []) as unknown as ReservedRow[]) {
    const key = row.source_event_id ?? "manual";
    let group = groupByKey.get(key);
    if (!group) {
      group = { key, eventId: row.source_event_id, date: row.events?.date ?? null, members: [] };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.members.push(row);
  }
  groups.sort((a, b) => {
    if (a.key === "manual") return 1;
    if (b.key === "manual") return -1;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Trophy className="h-6 w-6 text-amber-400" strokeWidth={2} />
          Torneios VPA
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Quem já garantiu vaga no próximo Torneio Vôlei Por Amor — vencendo um racha pré-torneio ou escolhido direto
          pelos organizadores.
        </p>
      </div>

      {profile.is_organizer && (
        <div className="space-y-3">
          <AddReservedPlayerForm action={addReservedPlayer} players={addOptions} />
          {(reserved?.length ?? 0) > 0 && <ClearReservedListButton action={clearReservedList} />}
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.key} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                {group.key === "manual" ? (
                  "Adicionados manualmente"
                ) : (
                  <>
                    <Trophy className="h-4 w-4 text-amber-400" strokeWidth={2} />
                    Time campeão — Pré-Torneio de{" "}
                    {group.date ? new Date(`${group.date}T00:00:00`).toLocaleDateString("pt-BR") : "data desconhecida"}
                  </>
                )}
              </h2>
              {group.eventId && (
                <Link
                  href={`/racha/${group.eventId}`}
                  className="inline-flex items-center gap-1 text-xs text-purple-300 hover:underline"
                >
                  Ver esse racha
                  <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </Link>
              )}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.members.map((r) => (
                <li
                  key={r.profile_id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <Avatar src={r.profiles?.avatar_url ?? null} name={r.profiles?.full_name ?? "?"} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{r.profiles?.full_name}</p>
                  {profile.is_organizer && (
                    <RemoveReservedPlayerButton
                      profileId={r.profile_id}
                      fullName={r.profiles?.full_name ?? "esse jogador"}
                      action={removeReservedPlayer}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && (
          <p className="text-sm text-white/60">
            Ninguém garantiu vaga ainda. Marque um racha como &ldquo;pré-torneio&rdquo; e o time campeão entra aqui
            sozinho quando a final for decidida.
          </p>
        )}
      </div>
    </div>
  );
}
