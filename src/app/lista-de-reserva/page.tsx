import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ListaDeReservaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: entry } = await supabase
    .from("reserve_list")
    .select("full_name, phone")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!entry) {
    redirect("/cadastro");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-white">
        Você está na lista de reserva, {entry.full_name.split(" ")[0]}!
      </h1>
      <p className="mt-2 text-white/60">
        Você não faz parte do grupo fixo, mas ficou anotado(a) com o telefone{" "}
        <strong className="text-white">{entry.phone}</strong>. Quando sobrar vaga de última
        hora em algum racha, um organizador vai te chamar por lá.
      </p>
      <Link href="/cadastro" className="mt-6 text-sm font-medium text-purple-300 hover:underline">
        Editar meus dados
      </Link>
    </div>
  );
}
