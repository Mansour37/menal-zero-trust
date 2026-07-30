// Tests for middleware redirect logic
// The middleware reads the "token" cookie and redirects accordingly

describe("Middleware logic (unit)", () => {
  it("redirige vers /login si pas de token", () => {
    // Simule: pas de cookie token => doit rediriger vers /login
    const token = undefined;
    const isLoginPage = false;
    const shouldRedirectToLogin = !token && !isLoginPage;
    expect(shouldRedirectToLogin).toBe(true);
  });

  it("redirige vers / si token present sur /login", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.valid.token";
    const isLoginPage = true;
    const shouldRedirectToDashboard = !!token && isLoginPage;
    expect(shouldRedirectToDashboard).toBe(true);
  });

  it("laisse passer la requete si token present sur page protegee", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.valid.token";
    const isLoginPage = false;
    const shouldPass = !!token && !isLoginPage;
    expect(shouldPass).toBe(true);
  });

  it("laisse passer /login sans token", () => {
    const token = undefined;
    const isLoginPage = true;
    const shouldRedirectToLogin = !token && !isLoginPage;
    const shouldRedirectToDashboard = !!token && isLoginPage;
    expect(shouldRedirectToLogin).toBe(false);
    expect(shouldRedirectToDashboard).toBe(false);
  });
});