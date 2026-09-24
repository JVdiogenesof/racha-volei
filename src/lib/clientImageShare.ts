export function saveImageBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export async function shareImageOrSave({
  blob,
  filename,
  title,
  text,
}: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
}): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const shareData = { title, text, files: [file] };

  if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) {
    saveImageBlob(blob, filename);
    return "saved";
  }

  try {
    await navigator.share(shareData);
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    // Alguns navegadores anunciam suporte a arquivos, mas falham ao abrir a
    // folha de compartilhamento. Nessa situação a pessoa ainda recebe a arte.
    saveImageBlob(blob, filename);
    return "saved";
  }
}
