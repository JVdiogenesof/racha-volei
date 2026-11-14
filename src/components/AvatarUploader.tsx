"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Camera, RotateCcw, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";
import { resetAvatarToGoogle, uploadAvatar } from "@/app/(app)/perfil/actions";

const SIZE = 384; // lado da foto final, em pixels
const BOX = 288; // lado da área de enquadramento na tela
const MAX_ZOOM = 4;

type Picked = { url: string; width: number; height: number; image: HTMLImageElement };

function loadImage(file: File): Promise<Picked> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ url, width: image.naturalWidth, height: image.naturalHeight, image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir essa imagem."));
    };
    image.src = url;
  });
}

export function AvatarUploader({ fullName, avatarUrl, frame }: { fullName: string; avatarUrl: string | null; frame: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!picked) return;
    const url = picked.url;
    return () => URL.revokeObjectURL(url);
  }, [picked]);

  useEffect(() => {
    if (!picked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [picked]);

  // Escala que faz a imagem cobrir a área toda (sem sobrar borda) no zoom 1.
  const baseScale = picked ? Math.max(BOX / picked.width, BOX / picked.height) : 1;
  const scale = baseScale * zoom;

  function clamp(x: number, y: number, s: number) {
    if (!picked) return { x: 0, y: 0 };
    const maxX = Math.max(0, (picked.width * s - BOX) / 2);
    const maxY = Math.max(0, (picked.height * s - BOX) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    try {
      const next = await loadImage(file);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setPicked(next);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível abrir essa imagem.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  function changeZoom(value: number) {
    setZoom(value);
    setOffset((o) => clamp(o.x, o.y, baseScale * value));
  }

  function save() {
    if (!picked) return;
    const current = picked;
    startTransition(async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível processar a imagem.");
        // Região da imagem original que está dentro da área de enquadramento.
        const left = BOX / 2 - (current.width * scale) / 2 + offset.x;
        const top = BOX / 2 - (current.height * scale) / 2 + offset.y;
        ctx.drawImage(current.image, -left / scale, -top / scale, BOX / scale, BOX / scale, 0, 0, SIZE, SIZE);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (!blob) throw new Error("Não foi possível processar a imagem.");
        const data = new FormData();
        data.set("photo", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        await uploadAvatar(data);
        setPicked(null);
        showToast("Foto atualizada! 📸");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível trocar a foto.");
      }
    });
  }

  function reset() {
    startTransition(async () => {
      try {
        await resetAvatarToGoogle();
        showToast("Voltou para a foto da sua conta Google.");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível voltar a foto.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Avatar src={avatarUrl} name={fullName} size="xl" frame={frame} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Foto de perfil</p>
        <p className="mt-0.5 text-xs text-white/50">Escolha uma foto da galeria ou tire uma agora. Antes de salvar você enquadra do jeito que quiser.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-full bg-purple-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-purple-400 disabled:opacity-60">
            <Camera className="h-3.5 w-3.5" aria-hidden /> Trocar foto
          </button>
          <button type="button" disabled={pending} onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-60">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Usar foto do Google
          </button>
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
      </div>

      {picked && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Enquadrar foto">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a0f3a] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-white">Enquadrar foto</p>
              <button type="button" onClick={() => setPicked(null)} disabled={pending} aria-label="Cancelar" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-xs text-white/50">Arraste para mover e use o controle para aproximar. O círculo é o que vai aparecer.</p>

            <div
              className="relative mx-auto mt-4 select-none overflow-hidden rounded-2xl bg-black"
              style={{ width: BOX, height: BOX, touchAction: "none", maxWidth: "100%" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
              }}
              onPointerMove={(e) => {
                const start = drag.current;
                if (!start) return;
                setOffset(clamp(start.ox + e.clientX - start.x, start.oy + e.clientY - start.y, scale));
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={picked.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: picked.width * scale,
                  height: picked.height * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" style={{ boxShadow: "0 0 0 999px rgba(10,5,30,0.62)" }} />
            </div>

            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="mt-4 w-full accent-purple-400"
            />

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPicked(null)} disabled={pending} className="flex-1 rounded-full border border-white/15 py-2 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={pending} className="flex-1 rounded-full bg-purple-500 py-2 text-sm font-bold text-white hover:bg-purple-400 disabled:opacity-60">
                {pending ? "Salvando..." : "Usar esta foto"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
