import { Cake, PartyPopper } from "lucide-react";
import { Avatar } from "./Avatar";
import { birthdaysThisMonth, type BirthdayProfile } from "@/lib/birthdays";

/** Card pequeno e isolado, só aparece no dia em que alguém faz aniversário. */
export function TodayBirthdayCard({ profiles }: { profiles: BirthdayProfile[] }) {
  const today = birthdaysThisMonth(profiles).filter((p) => p.isToday);
  if (!today.length) return null;

  return (
    <section className="flex items-center gap-3 overflow-hidden rounded-2xl border border-brand-purple/40 bg-gradient-to-r from-brand-purple/25 via-brand-purple/10 to-transparent px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-purple/25 text-purple-200">
        <Cake className="h-4.5 w-4.5" strokeWidth={2.25} />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {today.map((p) => (
          <div key={p.id} className="flex shrink-0 items-center gap-2">
            <Avatar src={p.avatar_url} name={p.full_name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-white">{p.full_name}</p>
              <p className="flex items-center gap-1 text-[10px] font-medium leading-tight text-purple-200">
                <PartyPopper className="h-3 w-3" strokeWidth={2.25} />
                Aniversário hoje! 🎉
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
