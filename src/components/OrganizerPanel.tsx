import Link from "next/link";
import { ShieldCheck, UserPlus, Inbox, Phone, AlertTriangle } from "lucide-react";

export function OrganizerPanel({
  proximoRachaId,
  interessadosCount,
  vagasRestantes,
  pendingCount,
  reserveCount,
  recentDeclines,
}: {
  proximoRachaId: string | null;
  interessadosCount: number;
  vagasRestantes: number | null;
  pendingCount: number;
  reserveCount: number;
  recentDeclines: { fullName: string }[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <ShieldCheck className="h-4.5 w-4.5 text-purple-300" strokeWidth={2} />
        Painel do organizador
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Link
          href={proximoRachaId ? `/racha/${proximoRachaId}/confirmar` : "/racha"}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center hover:bg-white/10"
        >
          <p className="text-xl font-bold text-white">
            {vagasRestantes === null ? "—" : vagasRestantes}
          </p>
          <p className="mt-0.5 text-xs text-white/60">
            {vagasRestantes === 0 ? "Lista cheia" : "Vagas restantes"}
          </p>
        </Link>

        <Link
          href={proximoRachaId ? `/racha/${proximoRachaId}/confirmar` : "/racha"}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center hover:bg-white/10"
        >
          <p className="text-xl font-bold text-white">{interessadosCount}</p>
          <p className="mt-0.5 text-xs text-white/60">Interessados</p>
        </Link>

        <Link
          href="/admin/solicitacoes"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center hover:bg-white/10"
        >
          <div className="flex items-center justify-center gap-1">
            <Inbox className="h-3.5 w-3.5 text-purple-300" strokeWidth={2} />
            <p className="text-xl font-bold text-white">{pendingCount}</p>
          </div>
          <p className="mt-0.5 text-xs text-white/60">Cadastros pendentes</p>
        </Link>

        <Link
          href="/admin/reserva"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center hover:bg-white/10"
        >
          <div className="flex items-center justify-center gap-1">
            <Phone className="h-3.5 w-3.5 text-purple-300" strokeWidth={2} />
            <p className="text-xl font-bold text-white">{reserveCount}</p>
          </div>
          <p className="mt-0.5 text-xs text-white/60">Na reserva</p>
        </Link>
      </div>

      {recentDeclines.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            {recentDeclines.map((d) => d.fullName).join(", ")} cancelou{recentDeclines.length > 1 ? "aram" : ""} a
            presença nas últimas 48h.
            {reserveCount > 0 && (
              <>
                {" "}
                <Link href="/admin/reserva" className="underline hover:text-red-200">
                  <UserPlus className="inline h-3.5 w-3.5" strokeWidth={2} /> Chamar alguém da reserva?
                </Link>
              </>
            )}
          </span>
        </p>
      )}
    </section>
  );
}
