import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createDecipheriv } from "node:crypto";
import { requireShirtAccess } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_PATH = path.join(process.cwd(), "src", "private-assets", "camisas", "modelos-vpa.mp4.enc");

async function readPrivateVideo() {
  const encodedKey = process.env.SHIRT_PREVIEW_VIDEO_KEY;
  if (!encodedKey) throw new Error("A chave do vídeo privado não está configurada.");

  const key = Buffer.from(encodedKey, "base64");
  if (key.byteLength !== 32) throw new Error("A chave do vídeo privado é inválida.");

  const encryptedFile = await readFile(VIDEO_PATH);
  const iv = encryptedFile.subarray(0, 12);
  const authenticationTag = encryptedFile.subarray(12, 28);
  const encryptedVideo = encryptedFile.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authenticationTag);
  return Buffer.concat([decipher.update(encryptedVideo), decipher.final()]);
}

function responseHeaders(size: number) {
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": "video/mp4",
    "Content-Disposition": 'inline; filename="modelos-vpa.mp4"',
    "Content-Length": String(size),
    Vary: "Cookie",
  };
}

export async function HEAD() {
  await requireShirtAccess();
  const file = await stat(VIDEO_PATH);
  return new Response(null, { status: 200, headers: responseHeaders(file.size - 28) });
}

export async function GET(request: Request) {
  await requireShirtAccess();
  const [video, file] = await Promise.all([readPrivateVideo(), stat(VIDEO_PATH)]);
  const videoSize = file.size - 28;
  const range = request.headers.get("range");

  if (!range) {
    return new Response(video, { status: 200, headers: responseHeaders(videoSize) });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${videoSize}` } });
  }

  const requestedStart = match[1] ? Number(match[1]) : null;
  const requestedEnd = match[2] ? Number(match[2]) : null;
  const start = requestedStart ?? Math.max(0, videoSize - (requestedEnd ?? videoSize));
  const end = Math.min(requestedStart == null ? videoSize - 1 : (requestedEnd ?? videoSize - 1), videoSize - 1);

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= videoSize) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${videoSize}` } });
  }

  const chunk = video.subarray(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      ...responseHeaders(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    },
  });
}
