"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";
import { resetAvatarToGoogle, uploadAvatar } from "@/app/(app)/perfil/actions";

const SIZE = 384;

// Recorta o centro em quadrado e reduz para 384px em WebP (~20-40 KB).
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return blob;
}

export function AvatarUploader({ fullName, avatarUrl, frame }: { fullName: string; avatarUrl: string | null; frame: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const { showToast } = useToast();

  function onPick(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      try {
        const blob = await toSquareWebp(file);
        setPreview(URL.createObjectURL(blob));
        const data = new FormData();
        data.set("photo", new File([blob], "foto.webp", { type: "image/webp" }));
        await uploadAvatar(data);
        showToast("Foto atualizada! 📸");
      } catch (error) {
        setPreview(null);
        showToast(error instanceof Error ? error.message : "Não foi possível trocar a foto.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  function reset() {
    startTransition(async () => {
      try {
        await resetAvatarToGoogle();
        setPreview(null);
        showToast("Voltou para a foto da sua conta Google.");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível voltar a foto.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Avatar src={preview ?? avatarUrl} name={fullName} size="xl" frame={frame} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Foto de perfil</p>
        <p className="mt-0.5 text-xs text-white/50">Escolha uma foto da galeria ou tire uma agora. Ela é cortada em quadrado.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-full bg-purple-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-purple-400 disabled:opacity-60">
            <Camera className="h-3.5 w-3.5" aria-hidden /> {pending ? "Enviando..." : "Trocar foto"}
          </button>
          <button type="button" disabled={pending} onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-60">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Usar foto do Google
          </button>
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
