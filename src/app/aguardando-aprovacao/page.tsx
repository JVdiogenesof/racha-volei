import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
          <h1 className="text-2xl font-bold text-brand-navy">Você foi removido do grupo</h1>
          <p className="mt-2 text-gray-500">
            Fale com um dos organizadores do racha se achar que foi engano.
          </p>
        </>
      ) : profile.status === "rejected" ? (
        <>
          <h1 className="text-2xl font-bold text-brand-navy">Cadastro não aprovado</h1>
          <p className="mt-2 text-gray-500">
            Fale com um dos organizadores do racha pra entender o motivo.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-brand-navy">
            Aguardando aprovação, {profile.full_name?.split(" ")[0]}!
          </h1>
          <p className="mt-2 text-gray-500">
            Seu cadastro foi enviado. Assim que um organizador aprovar, você já
            terá acesso completo ao site.
          </p>
          <Link
            href="/cadastro"
            className="mt-6 text-sm font-medium text-brand-purple hover:underline"
          >
            Editar meus dados
          </Link>
        </>
      )}
    </div>
  );
}
