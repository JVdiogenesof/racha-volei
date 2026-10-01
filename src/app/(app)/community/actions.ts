"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { COMMUNITY_COOKIE, parseCommunities, type Community } from "@/lib/community";

export async function switchCommunity(formData: FormData) {
  const profile = await requireProfile();
  const community = String(formData.get("community")) as Community;
  const available = profile.is_organizer ? ["court", "sand"] : parseCommunities(profile.communities);
  if (!available.includes(community)) throw new Error("Você ainda não tem acesso a esse racha.");

  const cookieStore = await cookies();
  cookieStore.set(COMMUNITY_COOKIE, community, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const requestedPath = String(formData.get("returnTo") ?? "/");
  redirect(requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/");
}
