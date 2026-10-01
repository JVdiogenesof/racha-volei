import Link from "next/link";
import {
  Clapperboard,
  Download,
  ExternalLink,
  FolderOpen,
  Play,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";

const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1NC15vjykfEVVpdKAdS0WBl7dZqTIC8xI";

export default async function MomentosPage() {
  await requireProfile();

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-purple-300/20 bg-gradient-to-br from-[#3b1768] via-[#211343] to-[#10142d] p-5 shadow-2xl shadow-purple-950/25 sm:p-7">
        <div aria-hidden="true" className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-blue-400/15 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-purple-100 shadow-lg shadow-black/15">
              <Clapperboard className="h-6 w-6" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Pasta disponível
            </span>
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/70">
            <Sparkles className="h-3.5 w-3.5" /> Melhores lances da galera
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Momentos VPA
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
            Ataques, defesas e jogadas marcantes gravadas nos nossos rachas, reunidos em um só lugar.
          </p>

          <Link
            href={DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#25104b] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-purple-50 active:translate-y-0 sm:w-auto sm:px-6"
          >
            <Play className="h-4 w-4 fill-current" />
            Abrir vídeos no Drive
            <ExternalLink className="h-4 w-4 opacity-55" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          { icon: FolderOpen, title: "Organizados", text: "Em uma pasta" },
          { icon: Smartphone, title: "No celular", text: "Assista fácil" },
          { icon: Download, title: "Baixe", text: "Guarde seu lance" },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/10 bg-white/[0.035] px-2 py-3 text-center sm:flex sm:items-center sm:gap-3 sm:p-4 sm:text-left"
          >
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-purple-400/10 text-purple-300 sm:mx-0 sm:h-10 sm:w-10 sm:shrink-0">
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0">
              <p className="mt-2 truncate text-[11px] font-bold text-white sm:mt-0 sm:text-sm">{item.title}</p>
              <p className="mt-0.5 truncate text-[9px] text-white/40 sm:text-xs">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-white">Como pegar seu vídeo</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["1", "Abra a pasta", "Toque no botão acima para entrar no Drive."],
            ["2", "Encontre seu lance", "Assista às prévias e escolha o vídeo."],
            ["3", "Salve no aparelho", "Use a opção de download do Google Drive."],
          ].map(([number, title, text]) => (
            <li key={number} className="flex gap-3 rounded-xl bg-white/[0.035] p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-black text-purple-200">
                {number}
              </span>
              <div>
                <p className="text-xs font-bold text-white">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="px-2 text-center text-[11px] leading-relaxed text-white/35">
        Os vídeos ficam armazenados no Google Drive e não ocupam espaço no banco de dados do aplicativo.
      </p>
    </div>
  );
}
