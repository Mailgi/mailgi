import { useState } from "react";
import { DashboardClient } from "../lib/dashboardClient.js";
import type { UserOrg } from "../lib/useDashboard.js";

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 24, maxWidth: 480, margin: "0 auto", width: "100%" },
  title: { fontSize: 16, color: "#e0e0e0", marginBottom: 12 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, marginBottom: 8, cursor: "pointer",
  },
  name: { color: "#e0e0e0", fontSize: 14 },
  role: { color: "#666", fontSize: 12 },
  form: { display: "flex", gap: 8, marginTop: 16 },
  input: {
    flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#e0e0e0",
    padding: "8px 10px", borderRadius: 6, fontSize: 13,
  },
  button: {
    background: "#2a6ecf", border: "none", color: "#fff", padding: "8px 16px",
    borderRadius: 6, cursor: "pointer", fontSize: 13,
  },
  error: { color: "#e66", fontSize: 12, marginTop: 8 },
};

export function OrgPicker({
  client, orgs, onSelect, onCreated,
}: {
  client: DashboardClient;
  orgs: UserOrg[];
  onSelect: (orgId: string) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const org = await client.createOrg(name.trim());
      setName("");
      onCreated();
      onSelect(org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.title}>Your organizations</div>
      {orgs.length === 0 && (
        <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
          You are not a member of any organization yet.
        </div>
      )}
      {orgs.map((o) => (
        <div key={o.id} style={s.row} onClick={() => onSelect(o.id)}>
          <span style={s.name}>{o.name}</span>
          <span style={s.role}>{o.role}</span>
        </div>
      ))}
      <form style={s.form} onSubmit={createOrg}>
        <input
          style={s.input}
          placeholder="New organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <button style={s.button} disabled={busy || !name.trim()}>Create</button>
      </form>
      {error && <div style={s.error}>{error}</div>}
    </div>
  );
}
