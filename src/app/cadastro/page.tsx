import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitCadastro } from "./actions";

export default async function CadastroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, birthdate, phone, is_setter")
    .eq("id", user.id)
    .maybeSingle();

  const defaultName =
    profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-bold text-brand-navy">Complete seu cadastro</h1>
      <p className="mt-1 text-sm text-gray-500">
        Esses dados ajudam a organizar o racha. Depois de enviar, um organizador
        precisa aprovar sua entrada.
      </p>

      <form action={submitCadastro} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-brand-navy">Nome completo</label>
          <input
            name="fullName"
            defaultValue={defaultName}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-navy">Data de aniversário</label>
          <input
            type="date"
            name="birthdate"
            defaultValue={profile?.birthdate ?? ""}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Telefone / WhatsApp <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            name="phone"
            defaultValue={profile?.phone ?? ""}
            placeholder="(85) 90000-0000"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-navy">
          <input
            type="checkbox"
            name="isSetter"
            defaultChecked={profile?.is_setter ?? false}
            className="h-4 w-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
          />
          Eu jogo de levantador(a)
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-purple px-4 py-3 font-medium text-white transition hover:bg-brand-purple-dark"
        >
          Enviar cadastro
        </button>
      </form>
    </div>
  );
}
