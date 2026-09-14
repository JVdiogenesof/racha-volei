import { Trophy } from "lucide-react";
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
        "profile_id, added_at, profiles!tournament_reserved_players_profile_id_profiles_id_fk(full_name, avatar_url), events!tournament_reserved_players_source_event_id_events_id_fk(date)",
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

      <ul className="grid gap-2 sm:grid-cols-2">
        {reserved?.map((r) => {
          const p = r.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
          const event = r.events as unknown as { date: string } | null;
          const originLabel = event
            ? `Garantido no racha de ${new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}`
            : "Adicionado manualmente";
          return (
            <li
              key={r.profile_id}
              className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
            >
              <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{p?.full_name}</p>
                <p className="truncate text-xs text-white/40">{originLabel}</p>
              </div>
              {profile.is_organizer && (
                <RemoveReservedPlayerButton
                  profileId={r.profile_id}
                  fullName={p?.full_name ?? "esse jogador"}
                  action={removeReservedPlayer}
                />
              )}
            </li>
          );
        })}
        {!reserved?.length && (
          <li className="text-sm text-white/60">
            Ninguém garantiu vaga ainda. Marque um racha como &ldquo;pré-torneio&rdquo; e o time campeão entra aqui
            sozinho quando o racha terminar.
          </li>
        )}
      </ul>
    </div>
  );
}
