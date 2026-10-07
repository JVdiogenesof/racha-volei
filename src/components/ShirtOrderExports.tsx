"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";
import { shirtOrderStatusLabel, type ShirtOrderStatus, SHIRT_MODELS, SHIRT_FITS, SHIRT_PAYMENT_LABELS, shirtPayment, type ShirtFit, formatShirtNumber, type ShirtModel } from "@/lib/shirts";
import { useToast } from "./Toast";
import type { Community } from "@/lib/community";

export type ExportShirtOrder = {
  fullName: string;
  phone: string;
  model: ShirtModel;
  shirtName: string;
  shirtNumber: number;
  size: string;
  quantity: number;
  paid: boolean;
  half_paid: boolean;
  fit: ShirtFit;
  fulfillment_status: ShirtOrderStatus;
};

export function ShirtOrderExports({ orders, community }: { orders: ExportShirtOrder[]; community: Community }) {
  const [filter, setFilter] = useState<"received" | "half" | "paid" | "all">("received");
  const selected = orders.filter((o) => filter === "all" || (filter === "paid" ? o.paid : filter === "half" ? o.half_paid : o.paid || o.half_paid));
  const filterLabel = { received: "Com entrada ou quitados", half: "Metade paga", paid: "Quitados", all: "Todos os pedidos" }[filter];
  const communityLabel = community === "sand" ? "Areia" : "Quadra";
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  function downloadCsv() {
    const escape = (value: string | number) => {
      const raw = String(value);
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["Pagamento", "Andamento", "Pessoa", "Telefone", "Modelo", "Modelagem", "Nome na camisa", "Número", "Tamanho", "Quantidade"],
      ...selected.map((order) => [SHIRT_PAYMENT_LABELS[shirtPayment(order)], shirtOrderStatusLabel(order), order.fullName, order.phone, SHIRT_MODELS[order.model].label, SHIRT_FITS[order.fit], order.shirtName, formatShirtNumber(order.shirtNumber), order.size, order.quantity]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escape).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pedidos-camisas-vpa-${community}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Lista selecionada baixada para enviar à loja.");
  }

  async function copyPaidList() {
    const paid = selected;
    const lines = [`👕 *CAMISAS VPA — ${filterLabel.toUpperCase()} · ${communityLabel.toUpperCase()}*`, ""];
    (["tank", "sleeve"] as ShirtModel[]).forEach((model) => {
      const modelOrders = paid.filter((order) => order.model === model);
      if (!modelOrders.length) return;
      lines.push(`*${SHIRT_MODELS[model].label.toUpperCase()}*`);
      modelOrders.forEach((order, index) => lines.push(`${index + 1}. ${order.fullName} — ${order.shirtName.toUpperCase()} ${formatShirtNumber(order.shirtNumber)} — ${SHIRT_FITS[order.fit]} — ${order.size} — ${SHIRT_PAYMENT_LABELS[shirtPayment(order)]} — ${shirtOrderStatusLabel(order)} — Qtd. ${order.quantity}`));
      lines.push("");
    });
    lines.push(`Total: ${paid.reduce((sum, order) => sum + order.quantity, 0)} camisa(s)`);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    showToast("Lista selecionada copiada para o WhatsApp.");
    setTimeout(() => setCopied(false), 2000);
  }

  async function getImage() {
    const response = await fetch("/admin/camisas/imagem?filter=" + filter, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte.");
    return response.blob();
  }

  async function shareArt() {
    setBusy("share");
    try {
      const result = await shareImageOrSave({ blob: await getImage(), filename: `pedidos-camisas-vpa-${community}.png`, title: `Camisas VPA · ${communityLabel}`, text: `Pedidos da nova camisa VPA · ${communityLabel} 👕💜` });
      if (result === "saved") showToast("Arte salva no aparelho!");
    } catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível compartilhar."); }
    finally { setBusy(null); }
  }

  async function downloadArt() {
    setBusy("download");
    try { saveImageBlob(await getImage(), `pedidos-camisas-vpa-${community}.png`); showToast("Arte salva no aparelho!"); }
    catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível baixar."); }
    finally { setBusy(null); }
  }

  return (
    <section className="rounded-2xl border border-purple-300/20 bg-purple-500/[0.07] p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200"><ImageIcon className="h-5 w-5" /></span><div><h2 className="font-bold text-white">Exportar para a loja e compartilhar</h2><p className="mt-1 text-sm text-white/50">Escolha quais pagamentos incluir na lista e na arte. A modelagem de cada peça também aparece.</p></div></div>
      <label className="mt-4 block text-sm">Exportar
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="mt-2 block min-h-11 w-full rounded-xl border border-white/15 bg-[#21123d] px-3">
          <option value="received">Com entrada ou quitados</option><option value="half">Metade paga</option><option value="paid">Quitados</option><option value="all">Todos os pedidos</option>
        </select>
      </label>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={downloadCsv} className={buttonClass}><Download className="h-4 w-4" />Baixar lista selecionada</button>
        <button type="button" onClick={() => void copyPaidList()} className={buttonClass}>{copied ? <Check className="h-4 w-4 text-green-300" /> : <ClipboardCopy className="h-4 w-4" />}Copiar lista</button>
        <button type="button" disabled={busy !== null} onClick={() => void shareArt()} className={buttonClass}>{busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}Compartilhar arte</button>
        <button type="button" disabled={busy !== null} onClick={() => void downloadArt()} className={buttonClass}>{busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}Baixar arte</button>
      </div>
    </section>
  );
}

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50";
