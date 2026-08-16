import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTokenExpired } from "@/lib/tokenExpiry";

export function middleware(request: NextRequest) {
  // MODE PREVIEW (dev) — contourne l'authentification pour travailler le
  // front-end sans API ni identifiants. À NE PAS promouvoir en production.
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const authenticated = !!token && !isTokenExpired(token);

  if (!authenticated && !isLoginPage) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete("token");
    return response;
  }
  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Exclut aussi les fichiers statiques de public/ (logo, icones...) par
  // extension plutot que par nom : sans ca, toute requete non authentifiee
  // vers un asset public (ex. le logo sur /login) etait redirigee vers
  // /login avant meme d'atteindre le fichier (307 au lieu de l'image) —
  // repere en verifiant le logo casse en direct sur staging apres deploiement.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
