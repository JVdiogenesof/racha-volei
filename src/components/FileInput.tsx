"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

export function FileInput({ name, accept }: { name: string; accept?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      {fileName ? (
        <div className="flex items-center justify-between rounded-lg border border-white/15 px-3 py-2 text-sm">
          <span className="truncate text-white">{fileName}</span>
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              setFileName(null);
            }}
            className="ml-2 shrink-0 text-white/40 hover:text-white/70"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-3 text-sm text-white/60 hover:border-brand-purple hover:text-purple-300"
        >
          <ImagePlus className="h-5 w-5" strokeWidth={2} />
          Escolher foto
        </button>
      )}
    </div>
  );
}
