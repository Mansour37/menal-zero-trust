/**
 * URL de l API MENAL, resolue AU MOMENT DE LA REQUETE (pas a l import).
 *
 * Pas de valeur par defaut : un fallback code en dur pointerait sur l API d un
 * seul environnement, donc un dashboard staging mal configure parlerait
 * silencieusement a l API dev (fuite inter-environnement). On echoue a la
 * premiere requete plutot que d authentifier contre la mauvaise base.
 *
 * Resolue paresseusement via une fonction (et non `export const`) : `next build`
 * importe ce module pour analyser les pages alors que API_URL n est pas encore
 * injecte (il l est au runtime par Cloud Run) ; une lecture a l import ferait
 * donc echouer le build. Les pages sont dynamiques (cookies()), donc apiUrl()
 * n est appele qu au moment de servir la requete, quand API_URL existe.
 */
let cached: string | undefined;

export function apiUrl(): string {
  if (cached) return cached;
  const url = process.env.API_URL;
  if (!url) {
    throw new Error(
      "API_URL manquant : le dashboard ne peut pas joindre l API MENAL de son environnement.",
    );
  }
  cached = url.replace(/\/$/, "");
  return cached;
}
