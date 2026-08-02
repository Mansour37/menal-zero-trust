"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode]         = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [step, setStep]         = useState<"credentials" | "mfa">("credentials");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body = new URLSearchParams({ username, password, grant_type: "password" });
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (res.status === 429) {
        setError(
          "Trop de tentatives de connexion depuis votre poste. " +
            "Reessayez dans quelques minutes.",
        );
        return;
      }
      if (!res.ok) {
        setError("Identifiants invalides");
        return;
      }
      const data = await res.json();
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        setStep("mfa");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code }),
      });
      if (!res.ok) {
        setError("Code de vérification invalide");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-slate-900 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2" aria-hidden>🛡️</div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            MENAL Zero Trust — Centre de supervision
          </p>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">
            {step === "credentials" ? "Connexion" : "Vérification en deux étapes"}
          </h1>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="admin@menal-sarl.mr"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Connexion"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-5" noValidate>
            <p className="text-sm text-slate-500">
              Saisissez le code à 6 chiffres généré par votre application d authentification
              (Google Authenticator, Authy...).
            </p>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">
                Code de vérification
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none tracking-[0.5em] text-center text-lg font-mono"
                placeholder="000000"
              />
            </div>

            {error && (
              <p role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {loading ? "Vérification..." : "Vérifier"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setCode(""); setError(""); }}
              className="w-full text-slate-500 text-sm hover:text-slate-700 transition"
            >
              Retour
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
