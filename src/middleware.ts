import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (
    !user &&
    (request.nextUrl.pathname === "/account" ||
      request.nextUrl.pathname.startsWith("/account/"))
  ) {
    const login = new URL("/login", request.url);
    const allowed = ["/account", "/account/bookings", "/account/orders"];
    login.searchParams.set(
      "next",
      allowed.includes(request.nextUrl.pathname)
        ? request.nextUrl.pathname
        : "/account",
    );
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
