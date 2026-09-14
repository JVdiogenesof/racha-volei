import { requireProfile } from "@/lib/auth";
import { PushOptIn } from "@/components/PushOptIn";

export default async function PerfilNotificacoesPage() {
  await requireProfile();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Notificações</h1>
      <p className="mt-1 text-sm text-white/60">
        Receba avisos direto no celular (racha novo, lista publicada, times prontos, etc.).
      </p>

      <div className="mt-6 rounded-xl border border-white/10 p-6">
        <PushOptIn />
      </div>
    </div>
  );
}
