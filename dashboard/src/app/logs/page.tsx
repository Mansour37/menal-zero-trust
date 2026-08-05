import { cookies } from "next/headers";
import { getLogs } from "@/lib/api";
import { AuditLog } from "@/lib/types";
import Sidebar from "@/components/Sidebar";

export default async function LogsPage() {
  const token = cookies().get("token")?.value ?? "";
  // Meme logique que la page alertes : une panne API n est pas "aucun log".
  let logs: AuditLog[] = [];
  let failed = false;
  try {
    logs = await getLogs(token, 0, 100);
  } catch {
    failed = true;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Logs API</h1>
          <span className="text-sm text-gray-500">{logs.length} entrées</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Méthode</th>
                  <th className="px-4 py-3">Ressource</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        l.action === "GET"    ? "bg-blue-100 text-blue-700" :
                        l.action === "POST"   ? "bg-green-100 text-green-700" :
                        l.action === "DELETE" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{l.resource}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        l.status_code < 300 ? "bg-green-100 text-green-700" :
                        l.status_code < 400 ? "bg-yellow-100 text-yellow-700" :
                        l.status_code < 500 ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {l.status_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.user_id ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{l.ip_address ?? "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className={`px-4 py-8 text-center ${failed ? "font-semibold text-red-600" : "text-gray-400"}`}
                    >
                      {failed
                        ? "Impossible de charger les logs (API injoignable)."
                        : "Aucun log disponible"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
