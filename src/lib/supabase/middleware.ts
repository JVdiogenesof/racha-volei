import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];
const ONBOARDING_PATHS = ["/cadastro", "/aguardando-aprovacao"];

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, is_organizer")
      .eq("id", user.id)
      .maybeSingle();

    const isOnboarding = ONBOARDING_PATHS.some((p) => pathname.startsWith(p));

    if (!profile && !isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = "/cadastro";
      return NextResponse.redirect(url);
    }

    if (
      (profile?.status === "pending" || profile?.status === "rejected") &&
      !isOnboarding
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/aguardando-aprovacao";
      return NextResponse.redirect(url);
    }

    if (profile?.status === "approved" && isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && !profile?.is_organizer) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
