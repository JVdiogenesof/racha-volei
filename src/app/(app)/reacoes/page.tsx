import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { pruneOldReactions, renderReactionText } from "@/lib/reactions";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { DeleteReactionButton } from "@/components/DeleteReactionButton";
import { sendReaction, deleteReaction } from "./actions";

function relativeDate(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "agora há pouco";
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "há 1 dia";
  return `há ${diffDays} dias`;
}

export default async function ReacoesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  await pruneOldReactions(supabase);

  const [{ data: reactionTypes }, { data: players }, { data: reactionRows }] = await Promise.all([
    supabase.from("reaction_types").select("id, text").eq("active", true).order("text"),
    supabase.from("profiles").select("id, full_name").eq("status", "approved").order("full_name"),
    supabase
      .from("reactions")
      .select(
        "id, created_at, from_profile_id, to_profile_id, reaction_types(text), from:profiles!reactions_from_profile_id_profiles_id_fk(full_name, avatar_url), to:profiles!reactions_to_profile_id_profiles_id_fk(full_name, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const feed = (reactionRows ?? []).map((r) => {
    const from = r.from as unknown as { full_name: string; avatar_url: string | null } | null;
    const to = r.to as unknown as { full_name: string; avatar_url: string | null } | null;
    const reactionType = r.reaction_types as unknown as { text: string } | null;
    return {
      id: r.id,
      createdAt: r.created_at,
      fromProfileId: r.from_profile_id,
      fromName: from?.full_name ?? "?",
      fromAvatar: from?.avatar_url ?? null,
      toName: to?.full_name ?? "?",
      toAvatar: to?.avatar_url ?? null,
      text: reactionType ? renderReactionText(reactionType.text, to?.full_name ?? "?") : "",
    };
  });

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <Swords className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Reações
      </h1>
      <p className="mt-1 text-sm text-white/60">
        Provoque a galera! Manda uma reação pra alguém e ela aparece aqui pra todo mundo ver.
      </p>

      <ActionForm
        action={sendReaction}
        successMessage="Reação enviada!"
        resetOnSuccess
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 p-6"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="block text-sm font-medium text-white">Pra quem?</label>
          <select
            name="toProfileId"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          >
            <option value="" disabled>
              Escolha um jogador
            </option>
            {(players ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === profile.id ? `${p.full_name} (você)` : p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-white">Qual reação?</label>
          <select
            name="reactionTypeId"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          >
            <option value="" disabled>
              Escolha uma reação
            </option>
            {(reactionTypes ?? []).map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.text.replace("{alvo}", "___")}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
        >
          Mandar reação!
        </button>
      </ActionForm>

      <div className="mt-6 space-y-2">
        {!feed.length && (
          <p className="text-sm text-white/60">Ninguém mandou reação ainda. Seja o primeiro!</p>
        )}
        {feed.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3"
          >
            <Avatar src={r.fromAvatar} name={r.fromName} size="sm" />
            <div className="min-w-0 flex-1 text-sm text-white">
              <span className="font-medium">{r.fromName}</span> {r.text}
              <p className="mt-0.5 text-xs text-white/40">{relativeDate(r.createdAt)}</p>
            </div>
            <Avatar src={r.toAvatar} name={r.toName} size="sm" />
            {(r.fromProfileId === profile.id || profile.is_organizer) && (
              <DeleteReactionButton reactionId={r.id} action={deleteReaction} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
