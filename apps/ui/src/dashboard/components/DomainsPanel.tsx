import { useEffect, useState } from "react";
import { DashboardClient, type DomainSummary } from "../lib/dashboardClient.js";
import { DomainDetail } from "./DomainDetail.js";

const s: Record<string, React.CSSProperties> = {
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, marginBottom: 8, cursor: "pointer",
  },
  domain: { color: "#e0e0e0", fontSize: 14 },
  status: { fontSize: 12 },
  ok: { color: "#4caf50" },
  pending: { color: "#e6a23c" },
  form: { display: "flex", gap: 8, marginTop: 12 },
  input: {
    flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#e0e0e0",
    padding: "8px 10px", borderRadius: 6, fontSize: 13,
  },
  button: { background: "#2a6ecf", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  back: { background: "none", border: "none", color: "#8ab4f8", cursor: "pointer", fontSize: 12, marginBottom: 12 },
  error: { color: "#e66", fontSize: 12, marginTop: 8 },
};

export function DomainsPanel({
  client, orgId, myRole,
}: { client: DashboardClient; orgId: string; myRole: string }) {
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canManage = myRole === "owner" || myRole === "admin";

  async function load() {
    const r = await client.listDomains(orgId);
    setDomains(r.domains);
  }

  useEffect(() => { void load(); }, [orgId]);

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setError(null);
    try {
      const d = await client.addDomain(orgId, newDomain.trim());
      setNewDomain("");
      await load();
      setSelected(d.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    }
  }

  if (selected) {
    return (
      <div>
        <button style={s.back} onClick={() => { setSelected(null); void load(); }}>
          ← back to domains
        </button>
        <DomainDetail client={client} orgId={orgId} domainId={selected} myRole={myRole} />
      </div>
    );
  }

  return (
    <div>
      {domains.map((d) => (
        <div key={d.id} style={s.row} onClick={() => setSelected(d.id)}>
          <span style={s.domain}>{d.domain}</span>
          <span style={{ ...s.status, ...(d.verified ? s.ok : s.pending) }}>
            {d.verified ? "verified" : "pending verification"}
          </span>
        </div>
      ))}
      {domains.length === 0 && (
        <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>No custom domains yet.</div>
      )}
      {canManage && (
        <form style={s.form} onSubmit={addDomain}>
          <input
            style={s.input} placeholder="mail.yourdomain.com" value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <button style={s.button} disabled={!newDomain.trim()}>Add domain</button>
        </form>
      )}
      {error && <div style={s.error}>{error}</div>}
    </div>
  );
}
