"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";

type Status = "loading" | "disabled" | "enrolling" | "enabled";

export default function SecuritySettingsPage() {
  const [status, setStatus]         = useState<Status>("loading");
  const [secret, setSecret]         = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode]             = useState("");
  const [password, setPassword]     = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError]           = useState("");
  const [busy, setBusy]             = useState(false);

  useEffect(() => {
    fetch("/api/mfa/status")
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setStatus(data.enabled ? "enabled" : "disabled"))
      .catch(() => setStatus("disabled"));
  }, []);

  async function startEnrollment() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de démarrer l activation du MFA.");
        return;
      }
      setSecret(data.secret);
      setOtpauthUri(data.otpauth_uri);
      setStatus("enrolling");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Code invalide.");
        return;
      }
      setStatus("enabled");
      setCode("");
      setSecret("");
      setOtpauthUri("");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Mot de passe ou code invalide.");
        return;
      }
      setStatus("disabled");
      setPassword("");
      setDisableCode("");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="text-blue-500" size={22} />
          <h1 className="text-xl font-bold text-slate-800">Sécurité du compte</h1>
        </div>

        <Card title="Authentification à deux facteurs (TOTP)">
          {status === "loading" && (
            <p className="text-sm text-slate-500">Chargement...</p>
          )}

          {status === "disabled" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Le MFA n est pas activé sur ce compte. Une fois activé, un code à 6 chiffres
                généré par une application d authentification (Google Authenticator, Authy...)
                sera exigé à chaque connexion, en plus du mot de passe.
              </p>
              {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
              <button
                onClick={startEnrollment}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
              >
                {busy ? "..." : "Activer le MFA"}
              </button>
            </div>
          )}

          {status === "enrolling" && (
            <form onSubmit={confirmEnrollment} className="space-y-4">
              <p className="text-sm text-slate-600">
                Scannez le QR code ci-dessous avec votre application d authentification, ou
                saisissez la clé manuellement, puis confirmez avec le code généré.
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Clé secrète (saisie manuelle)
                </label>
                <code className="block bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono break-all select-all">
                  {secret}
                </code>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  URI de provisionnement
                </label>
                <code className="block bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono break-all select-all">
                  {otpauthUri}
                </code>
              </div>
              <div>
                <label htmlFor="enroll-code" className="block text-sm font-medium text-slate-700 mb-1">
                  Code de confirmation
                </label>
                <input
                  id="enroll-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none tracking-[0.5em] text-center font-mono"
                  placeholder="000000"
                />
              </div>
              {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                >
                  {busy ? "..." : "Confirmer l activation"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatus("disabled"); setSecret(""); setOtpauthUri(""); setCode(""); setError(""); }}
                  className="text-slate-500 text-sm hover:text-slate-700 transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {status === "enabled" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                <ShieldCheck size={18} />
                MFA activé — une vérification TOTP est exigée à chaque connexion.
              </div>

              <form onSubmit={disableMfa} className="space-y-4 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Désactiver le MFA
                </p>
                <div>
                  <label htmlFor="disable-password" className="block text-sm font-medium text-slate-700 mb-1">
                    Mot de passe actuel
                  </label>
                  <input
                    id="disable-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="disable-code" className="block text-sm font-medium text-slate-700 mb-1">
                    Code de vérification
                  </label>
                  <input
                    id="disable-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none tracking-[0.5em] text-center font-mono"
                    placeholder="000000"
                  />
                </div>
                {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || disableCode.length !== 6 || !password}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                >
                  {busy ? "..." : "Désactiver le MFA"}
                </button>
              </form>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
