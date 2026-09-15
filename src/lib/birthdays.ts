export type BirthdayProfile = {
  id: string;
  full_name: string;
  birthdate: string | null;
  avatar_url: string | null;
};

export type BirthdayEntry = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  day: number;
  isThisWeek: boolean;
  isToday: boolean;
};

/**
 * Aniversariantes do mês corrente (ignora o ano de nascimento), ordenados
 * pelo dia. `isThisWeek` marca quem faz aniversário nos próximos 7 dias
 * (incluindo hoje) — útil pra destacar sem precisar de uma segunda lista.
 */
export function birthdaysThisMonth(profiles: BirthdayProfile[], today = new Date()): BirthdayEntry[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return profiles
    .filter((p): p is BirthdayProfile & { birthdate: string } => Boolean(p.birthdate))
    .map((p) => {
      const bd = new Date(`${p.birthdate}T00:00:00`);
      const nextOccurrence = new Date(startOfToday.getFullYear(), bd.getMonth(), bd.getDate());
      if (nextOccurrence < startOfToday) nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
      const daysUntil = Math.round((nextOccurrence.getTime() - startOfToday.getTime()) / 86_400_000);
      return {
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        month: bd.getMonth(),
        day: bd.getDate(),
        daysUntil,
      };
    })
    .filter((p) => p.month === today.getMonth())
    .sort((a, b) => a.day - b.day)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      day: p.day,
      isThisWeek: p.daysUntil <= 6,
      isToday: p.daysUntil === 0,
    }));
}
