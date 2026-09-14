import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { pruneOldReactions, renderReactionText } from "@/lib/reactions";
import { Avatar } from "@/components/Avatar";
import { ReactionSender } from "@/components/ReactionSender";
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
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved").order("full_name"),
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
      toProfileId: r.to_profile_id,
      fromName: from?.full_name ?? "?",
      fromAvatar: from?.avatar_url ?? null,
      toName: to?.full_name ?? "?",
      toAvatar: to?.avatar_url ?? null,
      text: reactionType ? renderReactionText(reactionType.text, to?.full_name ?? "?") : "",
    };
  });

  // Última reação recebida por jogador -- mostrada direto no card dele, sem
  // precisar abrir o perfil. O feed já vem ordenado do mais recente pro mais
  // velho, então a primeira ocorrência por jogador já é a mais recente.
  const lastReceivedByProfile = new Map<string, { text: string; fromName: string; createdAt: string }>();
  for (const r of feed) {
    if (!lastReceivedByProfile.has(r.toProfileId)) {
      lastReceivedByProfile.set(r.toProfileId, { text: r.text, fromName: r.fromName, createdAt: r.createdAt });
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <Swords className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Reações
      </h1>
      <p className="mt-1 text-sm text-white/60">
        Provoque a galera! Manda uma reação pra alguém e ela aparece aqui pra todo mundo ver.
      </p>

      <ReactionSender
        players={(players ?? []).map((p) => ({
          ...p,
          lastReceived: lastReceivedByProfile.get(p.id) ?? null,
        }))}
        reactionTypes={reactionTypes ?? []}
        currentProfileId={profile.id}
        action={sendReaction}
      />

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
