"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function createAnnouncement(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const image = formData.get("image") as File | null;

  if (!title || !body) throw new Error("Título e texto são obrigatórios.");

  let imageUrl: string | null = null;
  if (image && image.size > 0) {
    const path = `${organizer.id}/${Date.now()}-${image.name}`;
    const { error: uploadError } = await supabase.storage.from("avisos").upload(path, image);
    if (uploadError) throw new Error(uploadError.message);
    imageUrl = supabase.storage.from("avisos").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    image_url: imageUrl,
    created_by: organizer.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/avisos");
}

export async function deleteAnnouncement(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const announcementId = String(formData.get("announcementId"));

  const { error } = await supabase.from("announcements").delete().eq("id", announcementId);

  if (error) throw new Error(error.message);
  revalidatePath("/avisos");
}
