import "server-only";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export async function imageUrlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!contentType.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function embedAvatarUrls<T extends { avatarUrl: string | null }>(items: T[]): Promise<T[]> {
  const uniqueUrls = [...new Set(items.map((item) => item.avatarUrl).filter((url): url is string => Boolean(url)))];
  const resolved = new Map(
    await Promise.all(uniqueUrls.map(async (url) => [url, await imageUrlToDataUrl(url)] as const)),
  );
  return items.map((item) => ({ ...item, avatarUrl: item.avatarUrl ? (resolved.get(item.avatarUrl) ?? null) : null }));
}
