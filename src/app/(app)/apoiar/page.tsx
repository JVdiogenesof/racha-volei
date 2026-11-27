import { HandHeart, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { organizerCan, requireProfile } from "@/lib/auth";
import { DonationCard } from "@/components/DonationCard";
import { ActionForm } from "@/components/ActionForm";
import { createDonationCampaign, setDonationCampaignActive, updateDonationCampaign } from "./actions";

export const dynamic = "force-dynamic";

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  is_general: boolean;
  active: boolean;
  created_at: string;
};

type Donation = {
  id: string;
  campaign_id: string;
  amount: number;
  paid_at: string | null;
  profiles: { full_name: string } | null;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" });
}

const inputClass = "mt-1 block min-h-11 w-full rounded-xl border border-white/15 bg-[#21123d] px-3 text-sm text-white placeholder:text-white/30 focus:border-purple-300 focus:outline-none";

export default async function ApoiarPage() {
  const profile = await requireProfile();
  const isAdmin = organizerCan(profile, "admin");
  const supabase = await createClient();

  const [{ data: campaignRows, error }, { data: totalRows }, donationsResult] = await Promise.all([
    supabase.from("donation_campaigns").select("id, title, description, goal_amount, is_general, active, created_at").order("is_general", { ascending: false }).order("created_at", { ascending: false }),
    supabase.rpc("donation_campaign_totals"),
    isAdmin
      ? supabase.from("donation_intents").select("id, campaign_id, amount, paid_at, profiles!donation_intents_profile_id_fkey(full_name)").eq("status", "paid").order("paid_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as Donation[] }),
  ]);
  if (error) throw new Error(error.message);

  const campaigns = (campaignRows ?? []) as Campaign[];
  const totals = new Map(((totalRows ?? []) as { campaign_id: string; total: number; donations: number }[]).map((row) => [row.campaign_id, row]));
  const donations = ((donationsResult.data ?? []) as unknown as Donation[]);
  const active = campaigns.filter((campaign) => campaign.active);
  const closed = campaigns.filter((campaign) => !campaign.active);
  // Campanhas específicas aparecem primeiro; a geral ("Apoie o VPA") fica sempre por último como opção fixa.
  const ordered = [...active.filter((campaign) => !campaign.is_general), ...active.filter((campaign) => campaign.is_general)];
  const grandTotal = campaigns.reduce((sum, campaign) => sum + Number(totals.get(campaign.id)?.total ?? 0), 0);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-pink-300/20 bg-gradient-to-br from-[#3a0f3f] via-[#1f0b3d] to-[#120726] p-5 sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200/20 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-pink-100">
          <HandHeart className="h-3.5 w-3.5" /> Apoiar o VPA
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white text-balance sm:text-4xl">Faça parte do que a gente constrói junto</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
          Escolha uma campanha e o valor que quiser. O Pix é gerado aqui mesmo e o apoio entra no total na hora.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/50">
          <Lock className="h-3.5 w-3.5" /> Todos veem só o total arrecadado. Quem apoiou e quanto, só a organização.
        </p>
      </section>

      <div className="space-y-4">
        {ordered.map((campaign) => (
          <DonationCard
            key={campaign.id}
            campaignId={campaign.id}
            title={campaign.title}
            description={campaign.description}
            total={Number(totals.get(campaign.id)?.total ?? 0)}
            goal={campaign.goal_amount ? Number(campaign.goal_amount) : null}
            featured={!campaign.is_general}
          />
        ))}
      </div>

      {isAdmin && (
        <section className="space-y-4 rounded-2xl border border-red-300/20 bg-red-500/[0.04] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <ShieldCheck className="h-5 w-5 text-red-200" /> Organização: campanhas
            </h2>
            <p className="text-sm text-white/60">Total geral: <span className="font-bold text-emerald-300">{money.format(grandTotal)}</span></p>
          </div>

          <ActionForm action={createDonationCampaign} successMessage="Campanha criada!" resetOnSuccess className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-bold text-white">Nova campanha</p>
            <label className="block text-xs font-semibold text-white/60">
              Nome
              <input name="title" required minLength={2} maxLength={80} placeholder="Ex.: Aniversário de 2 anos do VPA" className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-white/60">
              Para que é (opcional)
              <textarea name="description" maxLength={600} rows={3} placeholder="Ex.: Bolo, decoração e premiação do torneio de aniversário." className={`${inputClass} py-2`} />
            </label>
            <label className="block text-xs font-semibold text-white/60">
              Meta em R$ (opcional)
              <input name="goal" inputMode="decimal" placeholder="Ex.: 500" className={inputClass} />
            </label>
            <button type="submit" className="min-h-11 w-full rounded-xl bg-purple-500 font-bold text-white hover:bg-purple-400">Criar campanha</button>
          </ActionForm>

          <ul className="space-y-3">
            {[...active, ...closed].map((campaign) => {
              const list = donations.filter((donation) => donation.campaign_id === campaign.id);
              const summary = totals.get(campaign.id);
              return (
                <li key={campaign.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white">{campaign.title}</p>
                      <p className="text-xs text-white/55">
                        {campaign.is_general ? "Sempre aberta" : campaign.active ? "Aberta" : "Encerrada"} · {money.format(Number(summary?.total ?? 0))} em {Number(summary?.donations ?? 0)} apoio{Number(summary?.donations ?? 0) === 1 ? "" : "s"}
                        {campaign.goal_amount ? ` · meta ${money.format(Number(campaign.goal_amount))}` : ""}
                      </p>
                    </div>
                    {!campaign.is_general && (
                      <ActionForm action={setDonationCampaignActive} successMessage="Pronto!">
                        <input type="hidden" name="campaignId" value={campaign.id} />
                        <input type="hidden" name="active" value={campaign.active ? "false" : "true"} />
                        <button type="submit" className={`min-h-9 rounded-lg px-3 text-xs font-bold ${campaign.active ? "bg-white/10 text-white/80 hover:bg-white/15" : "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"}`}>
                          {campaign.active ? "Encerrar" : "Reabrir"}
                        </button>
                      </ActionForm>
                    )}
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-purple-200">Editar</summary>
                    <ActionForm action={updateDonationCampaign} successMessage="Campanha salva!" className="mt-2 space-y-2">
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <input name="title" required minLength={2} maxLength={80} defaultValue={campaign.title} aria-label="Nome da campanha" className={inputClass} />
                      <textarea name="description" maxLength={600} rows={3} defaultValue={campaign.description ?? ""} aria-label="Descrição" className={`${inputClass} py-2`} />
                      <input name="goal" inputMode="decimal" defaultValue={campaign.goal_amount ? String(campaign.goal_amount).replace(".", ",") : ""} placeholder="Meta em R$ (opcional)" aria-label="Meta" className={inputClass} />
                      <button type="submit" className="min-h-10 w-full rounded-lg bg-purple-500/30 text-sm font-bold text-white hover:bg-purple-500/40">Salvar</button>
                    </ActionForm>
                  </details>

                  {list.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-semibold text-purple-200">Ver quem apoiou ({list.length})</summary>
                      <ul className="mt-2 divide-y divide-white/5 text-sm">
                        {list.map((donation) => (
                          <li key={donation.id} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="min-w-0 truncate text-white/80">{donation.profiles?.full_name ?? "Jogador"}</span>
                            <span className="shrink-0 text-white/55">
                              {dateLabel(donation.paid_at)} · <span className="font-bold text-emerald-300">{money.format(Number(donation.amount))}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
