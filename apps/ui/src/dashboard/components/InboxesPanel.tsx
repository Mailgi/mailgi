import { useEffect, useState } from "react";
import { DashboardClient } from "../lib/dashboardClient.js";

const s: Record<string, React.CSSProperties> = {
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 10px", background: "#1a1a1a", borderRadius: 6, marginBottom: 6, fontSize: 13,
  },
  email: { color: "#e0e0e0" },
  removeBtn: { background: "none", border: "none", color: "#a44", cursor: "pointer", fontSize: 12 },
  form: { display: "flex", gap: 8, marginTop: 8, alignItems: "center" },
  atSign: { color: "#666", fontSize: 13 },
  input: {
    flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#e0e0e0",
    padding: "6px 10px", borderRadius: 6, fontSize: 13,
  },
  button: { background: "#2a6ecf", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  keyBox: {
    background: "#111", border: "1px solid #2a6ecf", color: "#8ab4f8", borderRadius: 6,
    padding: "8px 10px", fontSize: 12, marginTop: 8, wordBreak: "break-all", cursor: "pointer",
  },
  error: { color: "#e66", fontSize: 12, marginTop: 6 },
};

interface Inbox { id: string; emailAddress: string; aliasAddress: string; label: string; createdAt: string }

export function InboxesPanel({
  client, orgId, domainId, domain, myRole,
}: { client: DashboardClient; orgId: string; domainId: string; domain: string; myRole: string }) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [localPart, setLocalPart] = useState("");
  const [newKey, setNewKey] = useState<{ emailAddress: string; apiKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = myRole === "owner" || myRole === "admin";

  async function load() {
    const r = await client.listInboxes(orgId, domainId);
    setInboxes(r.agents);
  }

  useEffect(() => { void load(); }, [domainId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!localPart.trim()) return;
    setError(null);
    try {
      const result = await client.createInbox(orgId, domainId, localPart.trim());
      setLocalPart("");
      setNewKey({ emailAddress: result.emailAddress, apiKey: result.apiKey });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create inbox");
    }
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Remove ${email}? Its API key(s) are revoked immediately.`)) return;
    await client.removeInbox(orgId, domainId, id);
    await load();
  }

  return (
    <div>
      {inboxes.map((a) => (
        <div key={a.id} style={s.row}>
          <span style={s.email}>{a.emailAddress}{a.label ? ` — ${a.label}` : ""}</span>
          {canManage && (
            <button style={s.removeBtn} onClick={() => remove(a.id, a.emailAddress)}>remove</button>
          )}
        </div>
      ))}
      {inboxes.length === 0 && <div style={{ color: "#555", fontSize: 12 }}>No inboxes yet.</div>}

      {canManage && (
        <form style={s.form} onSubmit={create}>
          <input
            style={s.input} placeholder="sales" value={localPart}
            onChange={(e) => setLocalPart(e.target.value)}
          />
          <span style={s.atSign}>@{domain}</span>
          <button style={s.button} disabled={!localPart.trim()}>Create</button>
        </form>
      )}
      {newKey && (
        <div style={s.keyBox} title="Click to copy the API key" onClick={() => navigator.clipboard.writeText(newKey.apiKey)}>
          Created {newKey.emailAddress}. API key (shown once — click to copy):<br />{newKey.apiKey}
        </div>
      )}
      {error && <div style={s.error}>{error}</div>}
    </div>
  );
}
