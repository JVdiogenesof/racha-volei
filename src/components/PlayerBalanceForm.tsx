"use client";

import { useState } from "react";
import { CircleDollarSign, WalletCards } from "lucide-react";
import { ActionForm } from "./ActionForm";

type PlayerOption = { id: string; fullName: string };

const defaults: Record<string, { effect: string; description: string; help: string }> = {
  advance_payment: { effect: "income", description: "Pagamento antecipado", help: "O dinheiro entrou agora e também vira saldo para a pessoa." },
  cancellation_credit: { effect: "none", description: "Crédito por desistência avisada", help: "A entrada já foi contada antes; agora só guardamos o valor para outro racha." },
  challenge: { effect: "none", description: "Prêmio de desafio", help: "Cria o saldo promocional sem retirar dinheiro do caixa agora. Quando for usado, o racha ficará sem essa entrada." },
  other: { effect: "none", description: "Ajuste de saldo", help: "Escolha abaixo se esse ajuste movimentou o caixa." },
};

export function PlayerBalanceForm({ action, players }: { action: (formData: FormData) => void | Promise<void>; players: PlayerOption[] }) {
  const [category, setCategory] = useState("advance_payment");
  const [cashEffect, setCashEffect] = useState("income");
  const [description, setDescription] = useState(defaults.advance_payment.description);

  function changeCategory(value: string) {
    const next = defaults[value] ?? defaults.other;
    setCategory(value);
    setCashEffect(next.effect);
    setDescription(next.description);
  }

  return (
    <ActionForm action={action} successMessage="Saldo registrado!" resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="lg:col-span-2"><FieldLabel>Pessoa</FieldLabel><select name="profileId" required defaultValue="" className="field"><option value="" disabled>Escolha a pessoa</option>{players.map((player) => <option key={player.id} value={player.id}>{player.fullName}</option>)}</select></label>
      <label><FieldLabel>Valor do saldo</FieldLabel><div className="relative"><CircleDollarSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-emerald-300" /><input name="amount" inputMode="decimal" required placeholder="13,00" className="field pl-9" /></div></label>
      <label className="lg:col-span-2"><FieldLabel>Origem do saldo</FieldLabel><select name="category" value={category} onChange={(event) => changeCategory(event.target.value)} className="field"><option value="advance_payment">Pagou adiantado</option><option value="cancellation_credit">Desistência avisada</option><option value="challenge">Ganhou desafio</option><option value="other">Outro motivo</option></select></label>
      <label><FieldLabel>Efeito no caixa</FieldLabel><select name="cashEffect" value={cashEffect} onChange={(event) => setCashEffect(event.target.value)} className="field"><option value="income">Entrada</option><option value="none">Sem movimento</option><option value="expense">Saída</option></select></label>
      <label className="sm:col-span-2 lg:col-span-3"><FieldLabel>Descrição</FieldLabel><input name="description" required maxLength={120} value={description} onChange={(event) => setDescription(event.target.value)} className="field" /></label>
      <label className="sm:col-span-2 lg:col-span-3"><FieldLabel>Observação opcional</FieldLabel><input name="notes" maxLength={500} placeholder="Detalhes para os administradores" className="field" /></label>
      <div className="sm:col-span-2 lg:col-span-6 flex flex-col gap-3 rounded-xl border border-white/8 bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-white/50">{defaults[category]?.help}</p><button type="submit" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-emerald-950 hover:bg-emerald-400"><WalletCards className="h-4 w-4" />Adicionar saldo</button></div>
    </ActionForm>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-white/55">{children}</span>;
}
