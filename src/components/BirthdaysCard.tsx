import { Cake, PartyPopper } from "lucide-react";
import { Avatar } from "./Avatar";
import { birthdaysThisMonth, type BirthdayProfile } from "@/lib/birthdays";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long" });

export function BirthdaysCard({ profiles }: { profiles: BirthdayProfile[] }) {
  const entries = birthdaysThisMonth(profiles);
  const monthName = MONTH_LABEL.format(new Date());

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <Cake className="h-5 w-5 text-purple-300" strokeWidth={2} />
        <h2 className="font-semibold text-white">
          Aniversariantes de {monthName}
        </h2>
      </div>

      {entries.length ? (
        <ul className="mt-4 space-y-3">
          {entries.map((p) => (
            <li key={p.id} className="flex items-center gap-3 text-sm">
              <Avatar src={p.avatar_url} name={p.full_name} size="sm" />
              <span className="flex-1 truncate text-white">{p.full_name}</span>
              <span className="text-xs text-white/40">dia {p.day}</span>
              {p.isThisWeek && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-purple/25 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                  <PartyPopper className="h-3 w-3" strokeWidth={2} />
                  essa semana
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/50">Ninguém faz aniversário esse mês.</p>
      )}
    </section>
  );
}
