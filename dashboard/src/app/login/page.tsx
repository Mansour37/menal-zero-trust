"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Fingerprint } from "lucide-react";

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
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Halo d'ambiance identitaire */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-[var(--accent)] opacity-[0.13] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-[var(--chart-2)] opacity-[0.08] blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="card-surface shadow-[var(--shadow-lg)] p-8">
          <div className="text-center mb-7">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[var(--accent-grad)] opacity-20 blur-xl" />
              <Image
                src="/logo-shield.png"
                alt="MENAL Sentinel"
                width={96}
                height={96}
                priority
                className="relative w-24 h-24 object-contain drop-shadow-[0_4px_16px_rgba(79,126,235,0.35)]"
              />
            </div>
            {step === "mfa" && (
              <>
                <h1 className="text-[22px] font-bold tracking-tight mt-4">
                  Vérification en deux étapes
                </h1>
                <p className="text-[12.5px] text-[var(--ink-muted)] mt-1">
                  Saisissez le code de votre application d&apos;authentification
                </p>
              </>
            )}
          </div>

          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-[12.5px] font-semibold text-[var(--ink-muted)] mb-1.5">
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
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[12.5px] font-semibold text-[var(--ink-muted)] mb-1.5">
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
                  className="input"
                />
              </div>

              {error && (
                <p role="alert" className="text-[var(--sev-critical)] text-[12.5px] bg-[var(--sev-critical-bg)] border border-[var(--sev-critical)]/30 rounded-lg px-3 py-2.5 leading-snug">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
                {loading ? "Connexion en cours…" : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="code" className="block text-[12.5px] font-semibold text-[var(--ink-muted)] mb-1.5">
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
                  className="input text-center tracking-[0.55em] font-mono text-lg"
                  placeholder="000000"
                />
              </div>

              {error && (
                <p role="alert" className="text-[var(--sev-critical)] text-[12.5px] bg-[var(--sev-critical-bg)] border border-[var(--sev-critical)]/30 rounded-lg px-3 py-2.5 leading-snug">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading || code.length !== 6} className="btn btn-primary w-full py-2.5">
                {loading ? "Vérification…" : "Vérifier"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setCode(""); setError(""); }}
                className="w-full text-[var(--ink-faint)] text-[12.5px] hover:text-[var(--ink)] transition"
              >
                Retour à la connexion
              </button>
            </form>
          )}
        </div>

        {/* Pied de page produit */}
        <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-[var(--ink-faint)]">
          <span className="flex items-center gap-1.5">
            <Lock size={11.5} /> Chiffré TLS
          </span>
          <span className="w-px h-3 bg-[var(--border-strong)]" />
          <span className="flex items-center gap-1.5">
            <Fingerprint size={11.5} /> MFA obligatoire
          </span>
        </div>
      </div>
    </div>
  );
}