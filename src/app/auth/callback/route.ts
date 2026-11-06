import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // O Google só entrega a foto atual no login. Se falhar, a pessoa entra
      // normalmente com a foto que já tinha.
      const { error: avatarError } = await supabase.rpc("sync_my_google_avatar");
      if (avatarError) console.error("Falha ao atualizar a foto do Google:", avatarError.message);
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
