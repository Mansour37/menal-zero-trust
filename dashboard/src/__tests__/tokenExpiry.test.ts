import { isTokenExpired } from "@/lib/tokenExpiry";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature-not-verified-here`;
}

describe("isTokenExpired (decode-only, UX hint — pas une verification de signature)", () => {
  it("considere un token avec exp dans le futur comme valide", () => {
    const token = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("considere un token avec exp dans le passe comme expire", () => {
    const token = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("considere un token malforme comme expire", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });

  it("considere une chaine vide comme expiree", () => {
    expect(isTokenExpired("")).toBe(true);
  });

  it("considere un payload sans claim exp comme expire (fail-closed)", () => {
    const token = fakeJwt({ sub: "u1" });
    expect(isTokenExpired(token)).toBe(true);
  });
});
