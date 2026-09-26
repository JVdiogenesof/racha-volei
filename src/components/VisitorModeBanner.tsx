import { Eye, LockKeyhole } from "lucide-react";

export function VisitorModeBanner({ invited }: { invited: boolean }) {
  return (
    <div className="border-b border-amber-300/20 bg-amber-400/10 px-4 py-2.5 text-amber-100">
      <div className="mx-auto flex max-w-5xl items-start gap-2.5 text-xs sm:items-center sm:text-sm">
        {invited ? (
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300 sm:mt-0" strokeWidth={2} />
        ) : (
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-300 sm:mt-0" strokeWidth={2} />
        )}
        <p>
          {invited ? (
            <><strong>Você foi chamado(a)!</strong> As ações estão liberadas somente no racha do seu convite; o restante continua para visualização.</>
          ) : (
            <><strong>Modo visitante:</strong> conheça todas as telas do VPA. Confirmações, votos e edições serão liberados quando um organizador chamar você para um racha.</>
          )}
        </p>
      </div>
    </div>
  );
}
