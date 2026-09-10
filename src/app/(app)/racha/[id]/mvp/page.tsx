import { notFound } from "next/navigation";
import { Trophy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { setMvp, clearMvp } from "./actions";

export default async function MvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: confirmed }] = await Promise.all([
    supabase.from("events").select("id, date, status, mvp_profile_id").eq("id", id).maybeSingle(),
    supabase
      .from("attendance")
      .select("profile_id, profiles(full_name, avatar_url)")
      .eq("event_id", id)
      .eq("status", "confirmed"),
  ]);
  if (!event) notFound();

  const eventFinished = event.status === "finished";

  const candidatos = (confirmed ?? [])
    .map((c) => {
      const p = c.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
      return {
        profileId: c.profile_id,
        fullName: p?.full_name ?? "—",
        avatarUrl: p?.avatar_url ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const mvp = candidatos.find((c) => c.profileId === event.mvp_profile_id) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-navy">
          <Trophy className="h-6 w-6 text-brand-purple" strokeWidth={2} />
          MVP · {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {!eventFinished
            ? "Libera depois que o organizador terminar o evento."
            : profile.is_organizer
              ? "Escolha quem foi o melhor jogador desse racha."
              : "O MVP é escolhido pelos organizadores depois do racha."}
        </p>
      </div>

      {!eventFinished ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Ainda não dá pra escolher o MVP — o racha precisa ser finalizado primeiro.
        </p>
      ) : !profile.is_organizer ? (
        <div className="rounded-xl border border-gray-200 px-4 py-8 text-center">
          {mvp ? (
            <>
              <Avatar src={mvp.avatarUrl} name={mvp.fullName} size="md" />
              <p className="mt-3 text-lg font-semibold text-brand-navy">🏆 {mvp.fullName}</p>
              <p className="mt-1 text-sm text-gray-500">foi o MVP desse racha!</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Os organizadores ainda não escolheram o MVP.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {candidatos.map((c) => {
            const isMvp = c.profileId === event.mvp_profile_id;
            return (
              <li
                key={c.profileId}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${isMvp ? "bg-amber-50/60" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={c.avatarUrl} name={c.fullName} size="sm" />
                  <span className="truncate text-sm text-brand-navy">
                    {isMvp && "🏆 "}
                    {c.fullName}
                  </span>
                </div>
                {isMvp ? (
                  <ActionForm action={clearMvp} successMessage="Escolha removida.">
                    <input type="hidden" name="eventId" value={id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                      Remover escolha
                    </button>
                  </ActionForm>
                ) : (
                  <ActionForm action={setMvp} successMessage={`${c.fullName} escolhido(a) como MVP!`}>
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="profileId" value={c.profileId} />
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-dark"
                    >
                      Escolher como MVP
                    </button>
                  </ActionForm>
                )}
              </li>
            );
          })}
          {!candidatos.length && (
            <li className="px-4 py-6 text-center text-sm text-gray-500">Ninguém confirmado presença nesse racha.</li>
          )}
        </ul>
      )}
    </div>
  );
}
