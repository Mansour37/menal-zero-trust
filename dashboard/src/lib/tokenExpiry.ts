/**
 * Decode-only (PAS de verification de signature) : lit la claim `exp` du
 * JWT pour permettre au middleware de rediriger proactivement vers /login
 * des qu'il est perime, sans attendre un 401 de l'API. Ce n'est PAS un
 * controle d'autorisation — la seule source de verite pour la signature et
 * le role reste l'API FastAPI (voir api/app/auth/dependencies.py), qui
 * verifie chaque requete cote serveur. Le secret de signature n'est jamais
 * partage avec ce service frontend.
 *
 * Isole de middleware.ts (qui importe next/server) pour rester testable
 * simplement en environnement jsdom, sans dependre des globals Edge Runtime.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded.exp !== "number") return true;
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
