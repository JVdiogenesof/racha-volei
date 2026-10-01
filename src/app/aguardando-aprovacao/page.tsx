import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(app)/actions";

export default async function AguardandoAprovacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/cadastro");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      {profile.status === "removed" ? (
        <>
          <h1 className="text-2xl font-bold text-white">Você foi removido do grupo</h1>
          <p className="mt-2 text-white/60">
            Fale com um dos organizadores do racha se achar que foi engano.
          </p>
          <p className="mt-3 text-sm text-white/45">
            Se esta não é a conta que você queria usar, troque de conta abaixo.
          </p>
        </>
      ) : profile.status === "rejected" ? (
        <>
          <h1 className="text-2xl font-bold text-white">Cadastro não aprovado</h1>
          <p className="mt-2 text-white/60">
            Fale com um dos organizadores do racha pra entender o motivo.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white">
            Aguardando aprovação, {profile.full_name?.split(" ")[0]}!
          </h1>
          <p className="mt-2 text-white/60">
            Seu cadastro foi enviado. Assim que um organizador aprovar, você já
            terá acesso completo ao site.
          </p>
          <Link
            href="/cadastro"
            className="mt-6 text-sm font-medium text-purple-300 hover:underline"
          >
            Editar meus dados
          </Link>
        </>
      )}

      <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="truncate text-xs text-white/45">Conta conectada</p>
        <p className="mt-1 truncate text-sm font-semibold text-white">{user.email}</p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-brand-navy transition hover:bg-purple-50"
          >
            <LogOut className="h-4 w-4" />
            Entrar com outra conta Google
          </button>
        </form>
      </div>
    </div>
  );
}
