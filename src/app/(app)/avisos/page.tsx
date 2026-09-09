import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { FileInput } from "@/components/FileInput";
import { createAnnouncement } from "./actions";

export default async function AvisosPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, image_url, created_at, profiles(full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-navy">
        <Megaphone className="h-6 w-6 text-brand-purple" strokeWidth={2} />
        Avisos
      </h1>

      {profile.is_organizer && (
        <form
          action={createAnnouncement}
          className="space-y-4 rounded-xl border border-gray-200 p-6"
        >
          <div>
            <label className="block text-sm font-medium text-brand-navy">Título</label>
            <input
              name="title"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-navy">Texto</label>
            <textarea
              name="body"
              required
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-navy">
              Foto <span className="text-gray-400">(opcional)</span>
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
        </form>
      )}

      <div className="space-y-4">
        {announcements?.map((a) => {
          const author = (a.profiles as unknown as { full_name: string } | null)?.full_name;
          return (
            <article key={a.id} className="rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-brand-navy">{a.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt={a.title} className="mt-3 max-h-96 w-full rounded-lg object-cover" />
              )}
              <p className="mt-3 text-xs text-gray-400">
                {author} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
              </p>
            </article>
          );
        })}
        {!announcements?.length && <p className="text-sm text-gray-500">Nenhum aviso ainda.</p>}
      </div>
    </div>
  );
}
