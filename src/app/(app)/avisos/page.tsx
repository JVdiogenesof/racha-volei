import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { FileInput } from "@/components/FileInput";
import { ActionForm } from "@/components/ActionForm";
import { DeleteAnnouncementButton } from "@/components/DeleteAnnouncementButton";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { createAnnouncement, deleteAnnouncement } from "./actions";

export default async function AvisosPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, image_url, created_at, profiles(full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <Megaphone className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Avisos
      </h1>

      {profile.is_organizer && (
        <ActionForm
          action={createAnnouncement}
          successMessage="Aviso publicado!"
          resetOnSuccess
          className="space-y-4 rounded-xl border border-white/10 p-6"
        >
          <div>
            <label className="block text-sm font-medium text-white">Título</label>
            <input
              name="title"
              required
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Texto</label>
            <textarea
              name="body"
              required
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">
              Foto <span className="text-white/40">(opcional)</span>
            </label>
            <div className="mt-1">
              <FileInput name="image" accept="image/*" />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
          >
            Publicar aviso
          </button>
        </ActionForm>
      )}

      <div className="space-y-4">
        {announcements?.map((a) => {
          const author = (a.profiles as unknown as { full_name: string } | null)?.full_name;
          return (
            <AnnouncementCard
              key={a.id}
              announcement={{ ...a, author }}
              actions={
                profile.is_organizer && (
                  <div className="absolute right-3 top-3">
                    <DeleteAnnouncementButton announcementId={a.id} action={deleteAnnouncement} />
                  </div>
                )
              }
            />
          );
        })}
        {!announcements?.length && <p className="text-sm text-white/60">Nenhum aviso ainda.</p>}
      </div>
    </div>
  );
}
