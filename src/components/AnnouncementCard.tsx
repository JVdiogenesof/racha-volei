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
    <article className="relative rounded-xl border border-gray-200 p-5">
      {actions}
      <h3 className="pr-12 font-semibold text-brand-navy">{announcement.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{announcement.body}</p>
      {announcement.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={announcement.image_url}
          alt={announcement.title}
          className="mt-3 max-h-[32rem] w-full rounded-lg bg-gray-50 object-contain"
        />
      )}
      <p className="mt-3 text-xs text-gray-400">
        {announcement.author} · {new Date(announcement.created_at).toLocaleDateString("pt-BR")}
      </p>
    </article>
  );
}
