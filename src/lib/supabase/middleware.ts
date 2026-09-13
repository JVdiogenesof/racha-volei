import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PROFILE_COLUMNS, USER_ID_HEADER, PROFILE_HEADER } from "./session-headers";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/privacidade"];
const ONBOARDING_PATHS = ["/cadastro", "/aguardando-aprovacao"];
const RESERVE_PATH = "/lista-de-reserva";
const SELF_RATING_PATH = "/autoavaliacao";
const HAS_SELF_RATING_COOKIE = "has_self_rating";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const [{ data: profile }, { data: reserveEntry }] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(),
      supabase.from("reserve_list").select("id").eq("auth_user_id", user.id).maybeSingle(),
    ]);

    // Repassa o perfil já carregado pros Server Components via header, pra
    // NavBar/NotificationCenter/requireProfile() não refazerem a mesma consulta
    // (+ getUser()) a cada navegação — era a maior causa de lentidão pra trocar
    // de tela, já que os três rodavam em toda página.
    if (profile) {
      const existingCookies = response.cookies.getAll();
      request.headers.set(USER_ID_HEADER, user.id);
      request.headers.set(PROFILE_HEADER, encodeURIComponent(JSON.stringify(profile)));
      response = NextResponse.next({ request });
      for (const cookie of existingCookies) response.cookies.set(cookie);
    }

    const isOnboarding = ONBOARDING_PATHS.some((p) => pathname.startsWith(p));
    const isReservePath = pathname.startsWith(RESERVE_PATH);

    // Gente de fora do grupo (lista de reserva) só vê a própria página de status.
    if (!profile && reserveEntry) {
      if (!isReservePath) {
        const url = request.nextUrl.clone();
        url.pathname = RESERVE_PATH;
        return NextResponse.redirect(url);
      }
      return response;
    }

    // Acesso temporário: só enxerga o racha pro qual foi chamado, e só
    // enquanto esse racha não tiver terminado/sido cancelado. Quando expira,
    // o próprio perfil temporário é apagado e a pessoa volta pra lista de reserva.
    if (profile?.status === "guest") {
      const { data: guestEvent } = await supabase
        .from("events")
        .select("status")
        .eq("id", profile.guest_for_event_id ?? "")
        .maybeSingle();

      const eventActive = guestEvent && guestEvent.status !== "finished" && guestEvent.status !== "cancelled";

      if (!eventActive) {
        await supabase.from("profiles").delete().eq("id", user.id);
        if (!isReservePath) {
          const url = request.nextUrl.clone();
          url.pathname = RESERVE_PATH;
          return NextResponse.redirect(url);
        }
        return response;
      }

      const allowedPrefix = `/racha/${profile.guest_for_event_id}`;
      if (!pathname.startsWith(allowedPrefix)) {
        const url = request.nextUrl.clone();
        url.pathname = allowedPrefix;
        return NextResponse.redirect(url);
      }

      return response;
    }

    if (profile && isReservePath) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (!profile && !isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = "/cadastro";
      return NextResponse.redirect(url);
    }

    if (
      (profile?.status === "pending" || profile?.status === "rejected" || profile?.status === "removed") &&
      !isOnboarding
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/aguardando-aprovacao";
      return NextResponse.redirect(url);
    }

    const isCadastroPath = pathname.startsWith("/cadastro");
    const isAguardandoPath = pathname.startsWith("/aguardando-aprovacao");
    // Convidado promovido a membro permanente já tem perfil (status approved)
    // mas pulou o formulário de cadastro — não preencheu aniversário/telefone/
    // posição. Trata como onboarding pendente até completar, do mesmo jeito
    // que a autoavaliação é exigida mais abaixo.
    const profileIncomplete = profile?.status === "approved" && !profile.birthdate;

    if (profile?.status === "approved" && isAguardandoPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (profile?.status === "approved" && profileIncomplete && !isCadastroPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/cadastro";
      return NextResponse.redirect(url);
    }

    if (profile?.status === "approved" && !profileIncomplete && isCadastroPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && !profile?.is_organizer) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const isSelfRatingPath = pathname.startsWith(SELF_RATING_PATH);

    if (profile?.status === "approved") {
      // Uma vez preenchida, a autoavaliação nunca deixa de existir — então dá
      // pra guardar isso num cookie e parar de bater no banco a cada
      // navegação só pra confirmar de novo o que já sabíamos.
      let hasSelfRating = request.cookies.get(HAS_SELF_RATING_COOKIE)?.value === "1";

      if (!hasSelfRating) {
        const { count } = await supabase
          .from("self_ratings")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", user.id);
        hasSelfRating = (count ?? 0) > 0;
        if (hasSelfRating) {
          response.cookies.set(HAS_SELF_RATING_COOKIE, "1", { maxAge: 60 * 60 * 24 * 365, path: "/" });
        }
      }

      if (!hasSelfRating && !isSelfRatingPath) {
        const url = request.nextUrl.clone();
        url.pathname = SELF_RATING_PATH;
        return NextResponse.redirect(url);
      }

      if (hasSelfRating && isSelfRatingPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
