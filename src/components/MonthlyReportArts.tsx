"use client";

import Image from "next/image";
import { Download, Images, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";
import { useToast } from "@/components/Toast";

const ARTS = [
  { id: "overview", label: "Capa e destaques" },
  { id: "performance", label: "Aproveitamento" },
  { id: "wins", label: "Vitórias" },
  { id: "mvp", label: "Jogadores destaque" },
  { id: "attendance", label: "Presenças" },
] as const;

type ArtId = (typeof ARTS)[number]["id"];

function artUrl(monthKey: string, art: ArtId) {
  return `/admin/resumo/imagem?month=${encodeURIComponent(monthKey)}&art=${art}`;
}

async function fetchArt(monthKey: string, art: ArtId) {
  const response = await fetch(artUrl(monthKey, art), { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte mensal.");
  return response.blob();
}

function filename(monthKey: string, art: ArtId) {
  return `vpa-resumo-${monthKey}-${art}.png`;
}

export function MonthlyReportArts({ monthKey }: { monthKey: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  async function shareOne(art: ArtId) {
    setBusy(`share-${art}`);
    try {
      const result = await shareImageOrSave({
        blob: await fetchArt(monthKey, art),
        filename: filename(monthKey, art),
        title: "Resumo mensal VPA",
        text: "Confira o resumo mensal do Vôlei Por Amor! 🏐💜",
      });
      if (result === "saved") showToast("Arte salva no aparelho.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte.");
    } finally {
      setBusy(null);
    }
  }

  async function saveOne(art: ArtId) {
    setBusy(`save-${art}`);
    try {
      saveImageBlob(await fetchArt(monthKey, art), filename(monthKey, art));
      showToast("Arte salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a arte.");
    } finally {
      setBusy(null);
    }
  }

  async function sharePack() {
    setBusy("pack");
    try {
      const blobs = await Promise.all(ARTS.map((art) => fetchArt(monthKey, art.id)));
      const files = blobs.map((blob, index) => new File([blob], filename(monthKey, ARTS[index].id), { type: "image/png" }));
      const shareData = { title: "Resumo mensal VPA", text: "Todos os rankings do mês no Vôlei Por Amor! 🏐💜", files };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      blobs.forEach((blob, index) => saveImageBlob(blob, filename(monthKey, ARTS[index].id)));
      showToast("As cinco artes foram salvas no aparelho.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível gerar o pacote de artes.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-7 rounded-2xl border border-purple-300/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-lg font-black text-white"><Images className="h-5 w-5 text-purple-300" /> Pacote mensal para Stories</p>
          <p className="mt-1 text-xs leading-5 text-white/55">Cinco artes: capa, aproveitamento, vitórias, destaques e presenças.</p>
        </div>
        <button type="button" onClick={sharePack} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-black text-white hover:bg-brand-purple-dark disabled:opacity-60">
          {busy === "pack" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Compartilhar pacote
        </button>
      </div>

      <div className="no-scrollbar mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
        {ARTS.map((art) => (
          <article key={art.id} className="w-[72vw] max-w-[250px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#100a2b]">
            <Image src={artUrl(monthKey, art.id)} alt={`Prévia da arte mensal de ${art.label}`} width={1080} height={1920} unoptimized className="aspect-[9/16] w-full bg-[#160d39] object-cover" />
            <div className="p-3">
              <p className="truncate text-sm font-bold text-white">{art.label}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => shareOne(art.id)} disabled={busy !== null} aria-label={`Compartilhar ${art.label}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-purple-500/20 text-xs font-bold text-purple-100 hover:bg-purple-500/30 disabled:opacity-60">
                  {busy === `share-${art.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Enviar
                </button>
                <button type="button" onClick={() => saveOne(art.id)} disabled={busy !== null} aria-label={`Salvar ${art.label}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-60">
                  {busy === `save-${art.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Salvar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
