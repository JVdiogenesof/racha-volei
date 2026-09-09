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
        <div className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <span className="truncate text-brand-navy">{fileName}</span>
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              setFileName(null);
            }}
            className="ml-2 shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 hover:border-brand-purple hover:text-brand-purple"
        >
          <ImagePlus className="h-5 w-5" strokeWidth={2} />
          Escolher foto
        </button>
      )}
    </div>
  );
}
