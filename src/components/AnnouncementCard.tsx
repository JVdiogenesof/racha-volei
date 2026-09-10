import type { ReactNode } from "react";

export type AnnouncementData = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  author?: string | null;
};

export function AnnouncementCard({
  announcement,
  actions,
}: {
  announcement: AnnouncementData;
  actions?: ReactNode;
}) {
  return (
    <article className="relative rounded-xl border border-white/10 p-5">
      {actions}
      <h3 className="pr-12 font-semibold text-white">{announcement.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{announcement.body}</p>
      {announcement.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={announcement.image_url}
          alt={announcement.title}
          className="mt-3 max-h-[75vh] w-full rounded-lg bg-white/5 object-contain"
        />
      )}
      <p className="mt-3 text-xs text-white/40">
        {announcement.author} · {new Date(announcement.created_at).toLocaleDateString("pt-BR")}
      </p>
    </article>
  );
}
